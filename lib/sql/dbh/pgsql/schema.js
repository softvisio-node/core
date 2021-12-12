import Schema from "#lib/sql/schema";
import { sql } from "#lib/sql/query";
import sqlConst from "#lib/sql/const";
import Cron from "#lib/cron";

const cronLockQuery = sql`
WITH cte AS (
    SELECT
        id
    FROM
        _cron
    WHERE
        id = ?
        AND next_start = ?
    FOR UPDATE
)
UPDATE
    _cron
SET
    last_started = CURRENT_TIMESTAMP,
    last_finished = NULL,
    next_start = ?,
    status = NULL
FROM
    cte
WHERE
    _cron.id = cte.id
RETURNING pg_try_advisory_lock( ?, _cron.id ) AS locked
`.prepare();

const cronUnlockQuery = sql`WITH cte AS ( SELECT pg_advisory_unlock( ?, ? ) ) UPDATE _cron SET last_finished = CURRENT_TIMESTAMP, status = ? WHERE id = ?`.prepare();

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

            // run cron
            cron.start();

            const nextDate = Date.parse( task.next_start ),
                currentDate = Date.now();

            // run missed task
            if ( nextDate <= currentDate && task.run_missed ) this.#runTask( task, cron );
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
    cron text NOT NULL,
    timezone text,
    query text NOT NULL,
    run_missed bool NOT NULL DEFAULT TRUE,
    last_started timestamptz,
    last_finished timestamptz,
    next_start timestamptz( 0 ) NOT NULL,
    status text,
    UNIQUE ( module, name )
);
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
                    const values = Object.keys( meta.cron ).map( name => {
                        const cron = new Cron( meta.cron[name].cron, { "timezone": meta.cron[name].timezone } );

                        return {
                            module,
                            name,
                            "cron": meta.cron[name].cron,
                            "timezone": meta.cron[name].timezone,
                            "query": meta.cron[name].query,
                            "run_missed": meta.cron[name].run_missed ?? true,
                            "next_start": cron.nextDate,
                        };
                    } );

                    if ( values.length ) {
                        res = await dbh.do( sql`
WITH cte AS (
    INSERT INTO
        _cron`.VALUES( values ).sql`
    ON CONFLICT ( module, name ) DO UPDATE SET
        cron = EXCLUDED.cron,
        timezone = EXCLUDED.timezone,
        query = EXCLUDED.query,
        run_missed = EXCLUDED.run_missed,
        next_start = CASE WHEN _cron.cron = EXCLUDED.cron AND COALESCE( _cron.timezone, '' ) = COALESCE( EXCLUDED.timezone, '' ) THEN _cron.next_start ELSE EXCLUDED.next_start END
    RETURNING id
)
DELETE FROM _cron WHERE NOT EXISTS ( SELECT FROM cte WHERE id = _cron.id )
` );
                        if ( !res.ok ) throw res;
                    }
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
        const tickDate = task.next_start;
        task.next_start = cron.nextDate;

        const dbh = this._pool._newDbh();

        try {

            // lock
            var res = await dbh.selectRow( cronLockQuery, [task.id, tickDate, task.next_start, sqlConst.locks.cron] );

            if ( !res.data?.locked ) throw `Cron task is already done`;

            // run query
            res = await dbh.exec( task.query );

            // unlock
            await dbh.do( cronUnlockQuery, [sqlConst.locks.cron, task.id, res.statusText, task.id] );
        }
        catch ( e ) {}

        dbh.destroy();
    }
}
