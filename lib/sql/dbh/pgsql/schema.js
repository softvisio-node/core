import Schema from "#lib/sql/schema";
import { sql } from "#lib/sql/query";

export default class extends Schema {
    #schemaCreated;

    // protected
    async _migrate ( meta, schema, patches ) {
        return this._pool.lock( async dbh => {
            var res,
                locks = {};

            // set pgsql advisory lock
            res = await dbh.selectRow( sql`SELECT pg_advisory_lock( ${this.getLockId( "migration" )} )` );
            if ( !res.ok ) return res;

            try {

                // create schema tables
                if ( !this.#schemaCreated ) {
                    res = await this.#createSchema( dbh );

                    if ( !res.ok ) throw res;

                    this.#schemaCreated = true;
                }

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
                {
                    const emits = new Set( meta.emits );

                    const res = await dbh.do( sql`UPDATE _schema SET emits = ? WHERE module = ?`, [emits.size ? [...emits].sort() : null, module] );

                    if ( !res.ok ) throw res;
                }

                // update module locks
                {
                    const res = await dbh.select( sql`SELECT * FROM _schema_lock WHERE module = ?`, [module] );
                    if ( !res.ok ) throw res;

                    const addLocks = new Set( meta.locks ),
                        deleteLocks = new Set();

                    if ( res.data ) {
                        for ( const row of res.data ) {
                            if ( addLocks.has( row.lock ) ) {
                                addLocks.delete( row.lock );

                                locks[row.lock] = row.id;
                            }
                            else {
                                deleteLocks.add( row.id );
                            }
                        }
                    }

                    if ( addLocks.size ) {
                        const res = await dbh.select( sql`INSERT INTO _schema_lock`.VALUES( [...addLocks].map( lock => ( {
                            module,
                            lock,
                        } ) ) ).sql`RETURNING *` );
                        if ( !res.ok ) throw res;

                        for ( const row of res.data ) locks[row.lock] = row.id;
                    }

                    if ( deleteLocks.size ) {
                        const res = await dbh.do( sql`DELETE FROM _schema_lock WHERE id`.IN( [...deleteLocks] ) );
                        if ( !res.ok ) throw res;
                    }
                }

                // update module cron schedule
                {
                    const values = Object.keys( meta.cron || {} ).map( name => {
                        return {
                            module,
                            name,
                            "cron": meta.cron[name].cron,
                            "timezone": meta.cron[name].timezone,
                            "query": Array.isArray( meta.cron[name].query ) ? meta.cron[name].query : [meta.cron[name].query],
                            "run_missed": meta.cron[name].runMissed ?? true,
                        };
                    } );

                    const cronDbh = this._pool._newConnection( { "database": "postgres" } );

                    if ( values.length ) {
                        res = await cronDbh.do( sql`
WITH cte AS (
    INSERT INTO
        cron.schedule`.VALUES( values ).sql`
    ON CONFLICT ( username, module, name ) DO UPDATE SET
        cron = EXCLUDED.cron,
        timezone = EXCLUDED.timezone,
        query = EXCLUDED.query,
        run_missed = EXCLUDED.run_missed
    RETURNING id
)
DELETE FROM cron.schedule WHERE module = ${module} AND NOT EXISTS ( SELECT FROM cte WHERE id = cron.schedule.id )
` );
                    }
                    else {
                        res = await cronDbh.do( `
DO $$
BEGIN
    IF EXISTS ( SELECT FROM pg_tables WHERE schemaname = 'cron' AND tablename = 'schedule' ) THEN
        DELETE FROM cron.schedule WHERE module = '${module}';
    END IF;
END;
$$
` );
                    }

                    cronDbh.destroy();

                    if ( !res.ok ) throw res;
                }

                res = result( 200, { locks } );
            }
            catch ( e ) {
                res = result.catch( e );
            }

            // remove pgsql advisory lock
            {
                const res = await dbh.selectRow( sql`SELECT pg_advisory_unlock( ${this.getLockId( "migration" )} )` );
                if ( !res.ok ) return res;
            }

            return res;
        } );
    }

    // private
    #createSchema ( dbh ) {
        return dbh.exec( sql`

CREATE TABLE IF NOT EXISTS _schema (
    module text PRIMARY KEY,
    patch int4,
    emits json
);

CREATE TABLE IF NOT EXISTS _cron (
    id int8 PRIMARY KEY NOT NULL,
    module text NOT NULL,
    name text NOT NULL,
    cron text NOT NULL,
    timezone text,
    query json NOT NULL,
    run_missed bool NOT NULL DEFAULT TRUE,
    next_start timestamptz( 0 ),
    last_started timestamptz,
    last_finished timestamptz,
    last_run_error text,
    schedule_error text,
    UNIQUE ( module, name )
);

CREATE SEQUENCE IF NOT EXISTS _schema_lock_id_seq AS int4 INCREMENT -1 START -100;

CREATE TABLE IF NOT EXISTS _schema_lock (
    id int4 PRIMARY KEY DEFAULT nextval( '_schema_lock_id_seq' ),
    module text NOT NULL REFERENCES _schema ( module ) ON DELETE CASCADE,
    lock text NOT NULL UNIQUE
);

CREATE OR REPLACE FUNCTION get_lock_id ( _lock text ) RETURNS int4 IMMUTABLE AS $$
DECLARE
    _id int8;
BEGIN
   SELECT id FROM _schema_lock WHERE lock = _lock INTO _id;

    IF _id IS NULL THEN
        RAISE EXCEPTION 'Advisoty lock "%" is not registered', _lock;
    END IF;

    RETURN _id;
END;
$$ LANGUAGE plpgsql;

` );
    }

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
}
