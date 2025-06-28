import { sql } from "#lib/sql/query";
import Schema from "#lib/sql/schema";

export default class extends Schema {
    #schemaCreated;

    // protected
    async _migrate ( meta, schema, patches, options ) {
        return this._pool.lock( async dbh => {
            var res,
                locks = {};

            // set postgresql advisory lock
            res = await dbh.selectRow( sql`SELECT pg_advisory_lock( ${ this.getLockId( "migration" ) } )` );
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
                res = await dbh.selectRow( sql`SELECT patch FROM _schema WHERE module = ?`, [ module ] );
                if ( !res.ok ) throw res;

                let moduleVersion = res.data?.patch;

                // apply full schema
                if ( schema.size ) {
                    res = await dbh.begin( async dbh => {
                        for ( const version of [ ...schema.keys() ].sort( ( a, b ) => a - b ) ) {
                            const patch = schema.get( version );

                            // apply patch
                            if ( moduleVersion == null ) await this.#applySchemaPatch( dbh, module, version, patch, options );
                        }

                        if ( moduleVersion == null ) {
                            moduleVersion = meta.patch;

                            // update module version
                            const res = await dbh.do( sql`INSERT INTO _schema ( module, patch ) VALUES ( ?, ? )`, [ module, moduleVersion ] );

                            if ( !res.ok ) throw res;
                        }
                    } );

                    if ( !res.ok ) throw res;
                }

                // apply schema patches
                if ( patches.size ) {
                    for ( const version of [ ...patches.keys() ].sort( ( a, b ) => a - b ) ) {
                        const patch = patches.get( version );

                        res = await dbh.begin( async dbh => {
                            let updated;

                            // apply patch
                            if ( version > moduleVersion ) {
                                await this.#applySchemaPatch( dbh, module, version, patch, options );

                                moduleVersion = version;
                                updated = true;
                            }

                            // update module version
                            if ( updated ) {
                                const res = await dbh.do( sql`INSERT INTO _schema ( module, patch ) VALUES ( ?, ? ) ON CONFLICT ( module ) DO UPDATE SET patch = ?`, [ module, moduleVersion, moduleVersion ] );

                                if ( !res.ok ) throw res;
                            }
                        } );

                        if ( !res.ok ) throw res;
                    }
                }

                // update module emits
                {
                    const emits = new Set( meta.emits );

                    const res = await dbh.do( sql`UPDATE _schema SET emits = ? WHERE module = ?`, [ emits.size
                        ? [ ...emits ].sort()
                        : null, module ] );

                    if ( !res.ok ) throw res;
                }

                // update module locks
                {
                    const res = await dbh.select( sql`SELECT * FROM _schema_lock WHERE module = ?`, [ module ] );
                    if ( !res.ok ) throw res;

                    const addLocks = new Set( meta.locks ),
                        deleteLocks = new Set();

                    if ( res.data ) {
                        for ( const row of res.data ) {
                            if ( addLocks.has( row.lock ) ) {
                                addLocks.delete( row.lock );

                                locks[ row.lock ] = row.id;
                            }
                            else {
                                deleteLocks.add( row.id );
                            }
                        }
                    }

                    if ( addLocks.size ) {
                        const res = await dbh.select( sql`INSERT INTO _schema_lock`.VALUES( [ ...addLocks ].map( lock => ( {
                            module,
                            lock,
                        } ) ) ).sql`RETURNING *` );
                        if ( !res.ok ) throw res;

                        for ( const row of res.data ) locks[ row.lock ] = row.id;
                    }

                    if ( deleteLocks.size ) {
                        const res = await dbh.do( sql`DELETE FROM _schema_lock WHERE id`.IN( [ ...deleteLocks ] ) );
                        if ( !res.ok ) throw res;
                    }
                }

                // update cron
                res = await this.cron.sync( dbh, module, meta );
                if ( !res.ok ) throw res;

                res = result( 200, { locks } );
            }
            catch ( e ) {
                res = result.catch( e );
            }

            // remove postgresql advisory lock
            {
                const res = await dbh.selectRow( sql`SELECT pg_advisory_unlock( ${ this.getLockId( "migration" ) } )` );
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
    patch int4 NOT NULL,
    emits json
);

CREATE TABLE IF NOT EXISTS _schema_cron (
    id serial4 PRIMARY KEY,
    module text NOT NULL,
    name text NOT NULL,
    cron text NOT NULL,
    timezone text,
    query json NOT NULL,
    run_missed boolean NOT NULL DEFAULT TRUE,
    next_start timestamptz( 0 ),
    last_start timestamptz,
    last_finish timestamptz,
    error boolean NOT NULL DEFAULT FALSE,
    status_text text,
    UNIQUE ( module, name )
);

CREATE OR REPLACE FUNCTION _schema_cron_after_insert_or_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify( '_schema_cron/update', json_build_object(
        'id', NEW.id,
        'cron', NEW.cron,
        'timezone', NEW.timezone,
        'query', NEW.query,
        'run_missed', NEW.run_missed,
        'next_start', NEW.next_start
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER _schema_cron_after_insert AFTER INSERT ON _schema_cron FOR EACH ROW EXECUTE FUNCTION _schema_cron_after_insert_or_update_trigger();

CREATE OR REPLACE TRIGGER _schema_cron_after_update AFTER UPDATE OF cron, timezone, query, run_missed ON _schema_cron FOR EACH ROW EXECUTE FUNCTION _schema_cron_after_insert_or_update_trigger();

CREATE OR REPLACE FUNCTION _schema_cron_after_delete_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify( '_schema_cron/delete', json_build_object(
        'id', OLD.id
    )::text );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER _schema_cron_after_delete AFTER DELETE ON _schema_cron FOR EACH ROW EXECUTE FUNCTION _schema_cron_after_delete_trigger();

CREATE SEQUENCE IF NOT EXISTS _schema_lock_id_seq AS int4 INCREMENT -1 START -100;

CREATE TABLE IF NOT EXISTS _schema_lock (
    id int4 PRIMARY KEY DEFAULT nextval( '_schema_lock_id_seq' ),
    module text NOT NULL REFERENCES _schema ( module ) ON DELETE CASCADE,
    lock text NOT NULL UNIQUE
);

CREATE OR REPLACE FUNCTION get_lock_id ( _lock text ) RETURNS int4 IMMUTABLE AS $$
DECLARE
    _id int4;
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

    async #applySchemaPatch ( dbh, module, version, patch, options ) {
        const action = patch.default;

        if ( !action ) return;

        var res;

        if ( typeof action === "function" ) {
            try {
                res = result.try( await action( dbh, options ), { "allowUndefined": true } );
            }
            catch ( e ) {
                res = result.catch( e );
            }
        }
        else {
            res = await dbh.exec( action );
        }

        if ( !res.ok ) throw result( [ 500, `Error applying patch for module "${ module }", patch "${ version }": ` + res.statusText ] );
    }
}
