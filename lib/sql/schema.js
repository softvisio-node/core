import glob from "#lib/glob";
import _url from "url";
import * as config from "#lib/config";
import sqlConst from "#lib/sql/const";
import { sql } from "#lib/sql/query";

export default class {
    #pool;
    #isLoaded = false;
    #emits = new Set();

    constructor ( pool ) {
        this.#pool = pool;
    }

    // properties
    get pool () {
        return this.#pool;
    }

    get emits () {
        return this.#emits;
    }

    get isLoaded () {
        return this.#isLoaded;
    }

    // public
    async load () {
        if ( this.#isLoaded ) return result( 200 );

        const res = await this.#pool.select( sql`SELECT * FROM _schema` );

        if ( !res.ok ) return res;

        if ( !res.data ) return result( 200 );

        this.#isLoaded = true;

        // apply emits
        for ( const row of res.data ) {
            if ( row.emits ) this.#emits = new Set( [...this.#emits, ...row.emits] );
        }

        return result( 200 );
    }

    async migrate ( url ) {
        try {
            var res;

            const path = _url.fileURLToPath( url );

            // load schema index
            const meta = config.read( path + "/index.yaml" );

            if ( !meta.module ) throw `Database schema module is required`;

            if ( meta.patch === undefined ) throw `Database schema patch is required`;

            // check type
            if ( !meta.type ) throw `Database schema type is required`;
            const type = new Set( Array.isArray( meta.type ) ? meta.type : [meta.type] );
            if ( this.#pool.isSqlite && !type.has( "sqlite" ) ) throw `Database schema type is not compatible with SQLite`;
            if ( this.#pool.isPgsql && !type.has( "pgsql" ) ) throw `Database schema type is not compatible with PostgreSQL`;

            // validate emits
            if ( meta.emits ) for ( const name of meta.emits ) if ( sqlConst.reservedEvents.has( name ) ) throw `Database event name "${name}" is reserved`;

            const schema = new Map(),
                patches = new Map();

            // load schema
            var files = glob.sync( "*.js", { "cwd": path, "nodir": true } );

            for ( const file of files ) {
                const version = Number( file.match( /^(\d+)/g )[0] );

                if ( schema.has( version ) ) throw `Database schema patch ${version} is already exists`;

                schema.set( version, await import( new URL( file, url + "/" ) ) );
            }

            // load patches
            files = glob.sync( "*.js", { "cwd": path + "/patch", "nodir": true } );

            for ( const file of files ) {
                const version = Number( file.match( /^(\d+)/g )[0] );

                if ( patches.has( version ) ) throw `Database patch ${version} is already exists`;

                patches.set( version, await import( new URL( "patch/" + file, url + "/" ) ) );
            }

            // migrate
            if ( this.#pool.isSqlite ) res = this.#migrateSync( meta, schema, patches );
            else res = await this.#migrateAsync( meta, schema, patches );

            if ( res.ok ) {
                this.#isLoaded = true;

                // store emits
                if ( meta.emits ) this.#emits = new Set( [...this.#emits, ...meta.emits] );
            }

            return res;
        }
        catch ( e ) {
            return result.catch( e );
        }
    }

    // private
    async #migrateAsync ( meta, schema, patches ) {
        return this.#pool.lock( async dbh => {
            var res;

            // set pgsql advisory lock
            if ( this.#pool.isPgsql ) {
                res = await dbh.selectRow( sql`SELECT pg_advisory_lock(${sqlConst.locks.migration})` );

                if ( !res.ok ) return res;
            }

            try {

                // create schema table
                res = await dbh.exec( sql`
CREATE TABLE IF NOT EXISTS _schema (
    module text PRIMARY KEY NOT NULL,
    patch int4,
    emits json
);

CREATE TABLE IF NOT EXISTS _cron (
    id serial4 PRIMARY KEY NOT NULL,
    module text NOT NULL,
    name text NOT NULL,
    cron text,
    timezone text,
    query text NOT NULL,
    last_started timestamptz,
    last_finished timestamptz,
    next_start timestamptz( 0 ),
    error text,
    UNIQUE ( module, name )
);

CREATE OR REPLACE FUNCTION _run_cron_task ( _id int4, _tick_date timestamptz( 0 ), _next_start timestamptz( 0 ) ) RETURNS bool AS $$
DECLARE
    _task _cron;
    _error text;
BEGIN
    IF ( SELECT pg_try_advisory_xact_lock( ${sqlConst.locks.cron}, _id ) = FALSE ) THEN RETURN FALSE; END IF;

    WITH updated AS (
        WITH cte AS (
            SELECT
                id
            FROM
                _cron
            WHERE
                id = _id
                AND ( next_start IS NULL OR next_start = _tick_date )
            FOR UPDATE
        )
        UPDATE
            _cron
        SET
            last_started = CURRENT_TIMESTAMP,
            last_finished = NULL,
            next_start = _next_start,
            error = NULL
        FROM
            cte
        WHERE
            _cron.id = cte.id
        RETURNING *
    )
    SELECT INTO _task * FROM updated;

    IF _task IS NULL THEN RETURN FALSE; END IF;

    EXECUTE _task.query;

    UPDATE _cron SET last_finished = statement_timestamp() WHERE id = _id;

    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS _error = MESSAGE_TEXT;

    UPDATE _cron SET last_finished = statement_timestamp(), error = _error WHERE id = _id;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

` );

                if ( !res.ok ) throw res;

                // process module
                const module = meta.module;

                // get current module version
                res = await dbh.selectRow( sql`SELECT patch FROM _schema WHERE module = ?`, [module] );
                if ( !res.ok ) throw res;

                let moduleVersion = res.data ? res.data.patch : undefined;

                // apply full schema
                if ( schema.size ) {
                    res = await dbh.begin( async dbh => {
                        for ( const version of [...schema.keys()].sort( ( a, b ) => a - b ) ) {
                            const patch = schema.get( version );

                            // apply patch
                            if ( moduleVersion === undefined ) await this._applySchemaPatch( dbh, module, version, patch );

                            // apply types
                            await this._applySchemaTypes( dbh, module, version, patch );
                        }

                        if ( moduleVersion === undefined ) {
                            moduleVersion = meta.patch;

                            // update module version
                            const res = await dbh.do( sql`INSERT INTO _schema ( module, patch ) VALUES ( ?, ? )`, [module, moduleVersion] );

                            if ( !res.ok ) throw res;
                        }
                    } );

                    if ( !res.ok ) throw res;
                }

                // apply schema patches
                if ( patches.size ) {
                    for ( const version of [...patches.keys()].sort( ( a, b ) => a - b ) ) {
                        const patch = patches.get( version );

                        res = await dbh.begin( async dbh => {
                            let updated;

                            // apply patch
                            if ( moduleVersion == null || version > moduleVersion ) {
                                await this._applySchemaPatch( dbh, module, version, patch );

                                moduleVersion = version;
                                updated = true;
                            }

                            // apply types
                            await this._applySchemaTypes( dbh, module, version, patch );

                            // update module version
                            if ( updated ) {
                                const res = await dbh.do( sql`INSERT INTO _schema ( module, patch ) VALUES ( ?, ? ) ON CONFLICT ( module ) DO UPDATE SET patch = ?`, [module, moduleVersion, moduleVersion] );

                                if ( !res.ok ) throw res;
                            }
                        } );

                        if ( !res.ok ) throw res;
                    }
                }

                // update module emits
                const emits = new Set( meta.emits );
                res = await dbh.do( sql`UPDATE _schema SET emits = ? WHERE module = ?`, [JSON.stringify( [...emits] ), module] );
                if ( !res.ok ) throw res;

                // update module crontab
                if ( meta.cron ) {
                    res = await dbh.do( sql`UPDATE _cron SET cron = NULL` );
                    if ( !res.ok ) throw res;

                    const values = Object.keys( meta.cron ).map( name => ( {
                        module,
                        name,
                        "cron": meta.cron[name].cron,
                        "timezone": meta.cron[name].timezone,
                        "query": meta.cron[name].query,
                    } ) );

                    if ( values.length ) {
                        res = await dbh.do( sql`INSERT INTO _cron`.VALUES( values ).sql`ON CONFLICT ( module, name ) DO UPDATE SET cron = EXCLUDED.cron, query = EXCLUDED.query` );
                        if ( !res.ok ) throw res;
                    }

                    res = await dbh.do( sql`DELETE FROM _cron WHERE cron IS NULL` );
                    if ( !res.ok ) throw res;
                }

                res = result( 200 );
            }
            catch ( e ) {
                res = result.catch( e );
            }

            // remove pgsql advisory lock
            if ( this.#pool.isPgsql ) {
                const res = await dbh.selectRow( sql`SELECT pg_advisory_unlock(${sqlConst.locks.migration})` );
                if ( !res.ok ) return res;
            }

            return res;
        } );
    }

    #migrateSync ( meta, schema, patches ) {
        const dbh = this;

        var res;

        try {

            // create migration schema
            res = dbh.exec( sql`
CREATE TABLE IF NOT EXISTS _schema (
    module text PRIMARY KEY NOT NULL,
    patch int4,
    emits json
)
` );

            if ( !res.ok ) throw res;

            // process module
            const module = meta.module;

            // get current module version
            res = dbh.selectRow( sql`SELECT patch FROM _schema WHERE module = ?`, [module] );
            if ( !res.ok ) throw res;

            let moduleVersion = res.data ? res.data.patch : undefined;

            // apply full schema
            if ( schema.size ) {
                res = dbh.begin( dbh => {
                    for ( const version of [...schema.keys()].sort( ( a, b ) => a - b ) ) {
                        const patch = schema.get( version );

                        // apply functions
                        this._applySchemaFunctions( dbh, module, version, patch );

                        // apply patch
                        if ( moduleVersion === undefined ) this._applySchemaPatch( dbh, module, version, patch );

                        // apply types
                        this._applySchemaTypes( dbh, module, version, patch );
                    }

                    if ( moduleVersion === undefined ) {
                        moduleVersion = meta.patch;

                        // update module version
                        const res = dbh.do( sql`INSERT INTO _schema ( module, patch ) VALUES ( ?, ? )`, [module, moduleVersion] );

                        if ( !res.ok ) throw res;
                    }
                } );

                if ( !res.ok ) throw res;
            }

            // apply schema patches
            if ( patches.size ) {
                for ( const version of [...patches.keys()].sort( ( a, b ) => a - b ) ) {
                    const patch = patches.get( version );

                    res = dbh.begin( dbh => {
                        let updated;

                        // apply functions
                        this._applySchemaFunctions( dbh, module, version, patch );

                        // apply patch
                        if ( moduleVersion == null || version > moduleVersion ) {
                            this._applySchemaPatch( dbh, module, version, patch );

                            moduleVersion = version;
                            updated = true;
                        }

                        // apply types
                        this._applySchemaTypes( dbh, module, version, patch );

                        // update module version
                        if ( updated ) {
                            const res = dbh.do( sql`INSERT INTO _schema ( module, patch ) VALUES ( ?, ? ) ON CONFLICT ( module ) DO UPDATE SET patch = ?`, [module, moduleVersion, moduleVersion] );

                            if ( !res.ok ) throw res;
                        }
                    } );

                    if ( !res.ok ) throw res;
                }
            }

            // update module emits
            const emits = new Set( meta.emits );
            res = dbh.do( sql`UPDATE _schema SET emits = ? WHERE module = ?`, [JSON.stringify( [...emits] ), module] );
            if ( !res.ok ) throw res;

            res = result( 200 );
        }
        catch ( e ) {
            res = result.catch( e );
        }

        return res;
    }
}
