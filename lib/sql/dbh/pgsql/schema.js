import Schema from "#lib/sql/schema";
import { sql } from "#lib/sql/query";
import sqlConst from "#lib/sql/const";

export default class extends Schema {

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
)
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
                {
                    const values = Object.keys( meta.cron || {} ).map( name => {
                        return {
                            module,
                            name,
                            "cron": meta.cron[name].cron,
                            "timezone": meta.cron[name].timezone,
                            "query": meta.cron[name].query,
                            "as_superuser": meta.cron[name].as_superuser ?? false,
                            "run_missed": meta.cron[name].run_missed ?? true,
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
        as_superuser = EXCLUDED.as_superuser,
        run_missed = EXCLUDED.run_missed
    RETURNING id
)
DELETE FROM cron.schedule WHERE username = CURRENT_USER AND module = ${module} AND NOT EXISTS ( SELECT FROM cte WHERE id = cron.schedule.id )
` );
                    }
                    else {
                        res = await await cronDbh.do( sql`DELETE FROM cron.schedule WHERE module = ${module}` );
                    }

                    cronDbh.destroy();

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
}
