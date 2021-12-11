import Schema from "#lib/sql/schema";
import { sql } from "#lib/sql/query";
import sqlConst from "#lib/sql/const";
import Cron from "#lib/cron";

const runTaskQuery = sql`SELECT _run_cron_task( ?, ?, ? )`.prepare();

export default class extends Schema {
    #cronTasks = {};

    // public
    async runCron () {
        if ( !this.isLoaded ) return;

        const cron = await this._pool.select( sql`SELECT * FROM _cron` );
        if ( !cron.ok ) return cron;

        if ( !cron.data ) return result( 200 );

        for ( const task of cron.data ) {
            const cron = ( this.#cronTasks[task.id] = new Cron( task.cron, { "timezone": task.timezone } ).on( "tick", this.#runTask.bind( this, task ) ).unref() );

            cron.tickDate = task.next_start;

            // run missed task
            if ( !task.next_start || Date.parse( task.next_start ) <= new Date() ) this.#runTask( task, cron );

            // start cron
            cron.start();
        }

        return result( 200 );
    }

    // protected
    async _migrate ( meta, schema, patches ) {
        return this._pool.lock( async dbh => {
            var res;

            // set pgsql advisory lock
            if ( this._pool.isPgsql ) {
                res = await dbh.selectRow( sql`SELECT pg_advisory_lock(${sqlConst.locks.migration})` );

                if ( !res.ok ) return res;
            }

            try {

                // create schema tables
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
    next_start timestamptz( 0 ) NOT NULL,
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
                            if ( moduleVersion === undefined ) await this.#applySchemaPatch( dbh, module, version, patch );

                            // apply types
                            await this.#applySchemaTypes( dbh, module, version, patch );
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
                                await this.#applySchemaPatch( dbh, module, version, patch );

                                moduleVersion = version;
                                updated = true;
                            }

                            // apply types
                            await this.#applySchemaTypes( dbh, module, version, patch );

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

                    const values = Object.keys( meta.cron ).map( name => {
                        const cron = new Cron( meta.cron[name].cron, { "timezone": meta.cron[name].timezone } );

                        return {
                            module,
                            name,
                            "cron": meta.cron[name].cron,
                            "timezone": meta.cron[name].timezone,
                            "query": meta.cron[name].query,
                            "next_start": cron.nextDate,
                        };
                    } );

                    if ( values.length ) {
                        res = await dbh.do( sql`
INSERT INTO
    _cron`.VALUES( values ).sql`
ON CONFLICT ( module, name ) DO UPDATE SET
    cron = EXCLUDED.cron,
    timezone = EXCLUDED.timezone,
    query = EXCLUDED.query,
    next_start = CASE WHEN _cron.cron = EXCLUDED.cron AND _cron.timezone = EXCLUDED.timezone THEN _cron.next_start ELSE EXCLUDED.next_start END
` );
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
            if ( this._pool.isPgsql ) {
                const res = await dbh.selectRow( sql`SELECT pg_advisory_unlock(${sqlConst.locks.migration})` );
                if ( !res.ok ) return res;
            }

            return res;
        } );
    }

    // private
    async #applySchemaPatch ( dbh, module, version, patch ) {
        const action = patch.default;

        if ( !action ) return;

        var res;

        if ( typeof action === "function" ) {
            try {
                res = result.try( await action( dbh ), { "allowUndefined": true } );
            }
            catch ( e ) {
                res = result.catch( e );
            }
        }
        else {
            res = await dbh.exec( action );
        }

        if ( !res.ok ) throw result( [500, `Error applying patch for module "${module}", patch "${version}": ` + res.statusText] );
    }

    async #applySchemaTypes ( dbh, module, version, patch ) {
        const types = patch.types;

        if ( !types ) return;

        for ( const name in types ) {
            const res = await dbh.addType( name, types[name] );

            if ( !res.ok ) throw result( [500, `Error applying types for module "${module}", patch "${version}": ` + res.statusText] );
        }
    }

    async #runTask ( task, cron ) {
        const nextDate = cron.nextDate.toISOString(),
            tickDate = cron.tickDate;

        cron.tickDate = nextDate;

        if ( task.reuse_connections ) {
            this._pool.selectRow( runTaskQuery, [task.id, tickDate, nextDate] );
        }
        else {
            const dbh = this._pool._newDbh();

            await dbh.selectRow( runTaskQuery, [task.id, tickDate, nextDate] );

            dbh.destroy();
        }
    }
}
