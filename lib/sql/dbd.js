import "#index";

import { v1 as uuidv1 } from "uuid";
import { SQL } from "./dbi.js";
import Events from "events";
import _path from "path";
import glob from "glob";
import fs from "#lib/fs";

const { SQL_MIGRATION_TABLE_NAME, SQL_MIGRATION_DEFAULT_MODULE, SQL_LOCKS } = ( await import( "#lib/const" ) ).default;

export class Dbh extends Events {
    _onQueryError ( e, query, position ) {
        let msg = `SQL erorr: "${e.message}" in `;

        if ( position ) {
            msg += query.substring( 0, position ) + " HERE ---> " + query.substring( position );
        }
        else {
            msg += query;
        }

        if ( e.stack ) msg += "\n" + e.stack;

        console.error( msg );

        return result.exception( [500, e.message] );
    }

    isQuery ( object ) {
        return object instanceof SQL;
    }

    queryToString ( query, params ) {

        // query object
        if ( this.isQuery( query ) ) {
            query = query.getQuery();

            // override params
            if ( !params ) params = query[1];

            query = query[0];
        }

        if ( !params ) params = [];

        var length = params.length,
            idx = 0;

        query = query.replace( /(?:\?|\$\d+)/g, () => {
            if ( idx >= length ) {
                throw Error( `SQL number of passed params is less, than number of placeholders in the query` );
            }
            else {
                return this.quote( params[idx++] );
            }
        } );

        if ( idx < length ) throw Error( `SQL number of passed params is greater, than number of placeholders in the query` );

        return query;
    }

    // TRANSACTION
    async begin ( mode, func ) {
        const useSavepoint = this.inTransaction;

        let dbh, savepointName;

        if ( useSavepoint ) {
            dbh = this;

            savepointName = uuidv1();
        }
        else {
            dbh = await this._getDbh( true );
        }

        if ( typeof mode === "function" ) {
            func = mode;
            mode = "BEGIN";
        }
        else {
            mode = "BEGIN " + mode;
        }

        // start transaction
        let res = await dbh.do( useSavepoint ? `SAVEPOINT "${savepointName}"` : mode );

        // transaction started
        if ( res.ok ) {
            try {

                // call transaction body
                res = result.tryResult( ( await func( dbh ) ) ?? result( 200 ) );

                // release savepoint
                const tres = await dbh.do( useSavepoint ? `RELEASE SAVEPOINT "${savepointName}"` : "COMMIT" );

                // release failed
                if ( !tres.ok ) res = tres;
            }
            catch ( e ) {
                res = result.catchResult( e );

                // rollback to savepoint
                await dbh.do( useSavepoint ? `ROLLBACK TO SAVEPOINT "${savepointName}"` : "ROLLBACK" );
            }
        }

        if ( !useSavepoint ) dbh.emit( "release", dbh );

        return res;
    }
}

export class DbhPool extends Dbh {
    #moduleVersion = {};
    #schema = {};
    #patch = {};

    // MIGRATION
    async loadSchema ( index, module = SQL_MIGRATION_DEFAULT_MODULE ) {

        // load schema metadata
        const meta = fs.config.read( index );

        this.#moduleVersion[module] = meta.version || 0;

        const path = _path.dirname( index );

        // load schema
        var files = glob.sync( "*.js", { "cwd": path, "nodir": true } );

        for ( const file of files ) {
            if ( file === "index.js" ) continue;

            const id = file.match( /^(\d+)/g )[0];

            this.#addSchema( id, module, ( await import( path + "/" + file ) ).default );
        }

        // load patches
        files = glob.sync( "*.js", { "cwd": path + "/patch", "nodir": true } );

        for ( const file of files ) {
            const id = file.match( /^(\d+)/g )[0];

            this.#addPatch( id, module, ( await import( path + "/patch/" + file ) ).default );
        }
    }

    async migrate () {
        const res = await this.begin( async dbh => {
            if ( this.isPgsql ) await dbh.do( `SELECT pg_advisory_xact_lock(${SQL_LOCKS.MIGRATION})` );

            // create migration schema
            let res = await dbh.do( `
                CREATE TABLE IF NOT EXISTS "${SQL_MIGRATION_TABLE_NAME}" (
                    "module" text PRIMARY KEY NOT NULL,
                    "version" int4 NOT NULL
                )
            ` );

            if ( !res.ok ) throw res;

            for ( const module of Object.keys( this.#schema ).sort() ) {

                // get current module version
                res = await dbh.selectRow( `SELECT "version" FROM "${SQL_MIGRATION_TABLE_NAME}" WHERE "module" = ?`, [module] );

                if ( !res.ok ) throw res;

                let moduleVersion = res.data?.version;
                const initialModuleVersion = moduleVersion;

                // process schema
                if ( this.#schema[module] ) {
                    for ( const version of Object.keys( this.#schema[module] ).sort( ( a, b ) => a - b ) ) {
                        const patch = this.#schema[module][version];

                        this.#applyFunctions( dbh, patch );

                        // apply main schema
                        if ( moduleVersion == null ) await this.#applySql( dbh, patch );

                        await this.#applyTypes( dbh, patch );
                    }

                    if ( moduleVersion == null ) moduleVersion = this.#moduleVersion[module];
                }

                // process schema patches
                if ( this.#patch[module] ) {
                    for ( const version of Object.keys( this.#patch[module] ).sort( ( a, b ) => a - b ) ) {
                        const patch = this.#patch[module][version];

                        this.#applyFunctions( dbh, patch );

                        // apply full schema
                        if ( patch.version > moduleVersion ) {
                            await this.#applySql( dbh, patch );

                            moduleVersion = version;
                        }

                        await this.#applyTypes( dbh, patch );
                    }
                }

                if ( moduleVersion !== initialModuleVersion ) {
                    res = await dbh.do( `INSERT INTO "${SQL_MIGRATION_TABLE_NAME}" ("module", "version") VALUES (?, ?) ON CONFLICT ("module") DO UPDATE SET "version" = ?`, [module, moduleVersion, moduleVersion] );

                    if ( !res.ok ) throw res;
                }
            }

            return result( 200 );
        } );

        // cleanup
        this.#moduleVersion = {};
        this.#schema = {};
        this.#patch = {};

        return res;
    }

    #addSchema ( id, module, patch ) {
        if ( !this.#schema[module] ) this.#schema[module] = {};
        if ( this.#schema[module][id] ) throw `Schema patch id "${id}" for module "${module}" is already exists`;

        this.#schema[module][id] = this.#preparePatch( id, module, patch );
    }

    #addPatch ( id, module, patch ) {
        if ( !this.#patch[module] ) this.#patch[module] = {};
        if ( this.#patch[module][id] ) throw `Schema patch id "${id}" for module "${module}" is already exists`;

        this.#patch[module][id] = this.#preparePatch( id, module, patch );
    }

    #preparePatch ( id, module, patch ) {
        var sql, types, functions;

        if ( Object.isPlain( patch ) ) {
            if ( this.isSqlite && patch.sqlite ) {
                if ( Object.isPlain( patch.sqlite ) ) {
                    sql = patch.sqlite.sql;
                    types = patch.sqlite.types;
                    functions = patch.sqlite.functions;
                }
                else sql = patch.sqlite;
            }
            else if ( this.isPgsql && patch.pgsql ) {
                if ( Object.isPlain( patch.pgsql ) ) {
                    sql = patch.pgsql.sql;
                    types = patch.pgsql.types;
                }
                else sql = patch.pgsql;
            }
            else {
                sql = patch.sql;
                types = patch.types;
                functions = patch.functions;
            }
        }
        else sql = patch;

        return { module, "version": +id, sql, types, functions };
    }

    #applyFunctions ( dbh, patch ) {
        if ( !this.isSqlite ) return;

        if ( !patch.functions ) return;

        try {
            for ( const name in patch.functions ) {
                dbh.db.function( name, patch.functions[name] );
            }
        }
        catch ( e ) {
            throw result( [500, `Error applying functions for module "${patch.module}", patch "${patch.version}": ` + e] );
        }
    }

    async #applySql ( dbh, patch ) {
        if ( !patch.sql ) return;

        var res;

        if ( typeof patch.sql === "function" ) {
            try {
                res = result.tryResult( await patch.sql( dbh ) );
            }
            catch ( e ) {
                res = result.catchResult( e );

                throw result( [500, `Error applying sql for module "${patch.module}", patch "${patch.version}": ` + res.reason] );
            }
        }
        else {
            res = await dbh.exec( patch.sql );
        }

        if ( !res.ok ) throw result( [500, `Error applying sql for module "${patch.module}", patch "${patch.version}": ` + res.reason] );
    }

    async #applyTypes ( dbh, patch ) {
        if ( !patch.types ) return;

        for ( const name in patch.types ) {
            const res = await dbh.addType( { ...patch.types[name], name } );

            if ( !res.ok ) throw result( [500, `Error applying types for module "${patch.module}", patch "${patch.version}": ` + res.reason] );
        }
    }
}

export async function connect ( url, options ) {
    url = new URL( url );

    var Class;

    if ( url.protocol === "pgsql:" ) {
        Class = ( await import( "./dbd/pgsql.js" ) ).default;
    }
    else if ( url.protocol === "sqlite:" ) {
        Class = ( await import( "./dbd/sqlite.js" ) ).default;
    }
    else {
        throw `Invalid sql protocol`;
    }

    return new Class( url, options );
}
