import "#lib/result";
import { v1 as uuidv1 } from "#lib/uuid";
import { SQL } from "./query.js";
import Events from "events";
import glob from "#lib/glob";
import _url from "url";
import * as config from "#lib/config";

import CONST from "#lib/const";

export class DBH extends Events {
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

    queryToString ( query, params ) {

        // query object
        if ( query instanceof SQL ) {

            // override params
            params ||= query.params;

            query = query.query;
        }

        if ( !params ) params = [];

        var length = params.length,
            idx = 0;

        // substitute params
        query = query.replace( /(?:\?|\$\d+)/g, () => {
            if ( idx >= length ) throw Error( `SQL number of passed params is less, than number of placeholders in the query` );

            return this.quote( params[idx++] );
        } );

        if ( idx < length ) throw Error( `SQL number of passed params is greater, than number of placeholders in the query` );

        return query;
    }

    // transaction
    async begin ( mode, callback ) {
        const useSavepoint = this.inTransaction;

        let dbh, savepointName;

        if ( useSavepoint ) {
            dbh = this;

            savepointName = uuidv1();
        }
        else {
            dbh = await this._getDBH( true );
        }

        if ( typeof mode === "function" ) {
            callback = mode;
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
                res = result.try( ( await callback( dbh ) ) ?? result( 200 ) );

                // release savepoint
                const tres = await dbh.do( useSavepoint ? `RELEASE SAVEPOINT "${savepointName}"` : "COMMIT" );

                // release failed
                if ( !tres.ok ) res = tres;
            }
            catch ( e ) {
                res = result.catch( e );

                // rollback to savepoint
                await dbh.do( useSavepoint ? `ROLLBACK TO SAVEPOINT "${savepointName}"` : "ROLLBACK" );
            }
        }

        if ( !useSavepoint ) dbh.emit( "release", dbh );

        return res;
    }

    // lock
    async lock ( callback ) {
        const dbh = await this._getDBH( true );

        var res;

        // transaction started
        try {

            // call transaction body
            res = result.try( ( await callback( dbh ) ) ?? result( 200 ) );
        }
        catch ( e ) {
            res = result.catch( e );
        }

        // release dbh
        dbh.emit( "release", dbh );

        return res;
    }
}

export class DBHPool extends DBH {
    #moduleVersion = {};
    #schema = {};
    #patch = {};

    // migration
    async loadSchema ( url, module = CONST.SQL_MIGRATION_DEFAULT_MODULE ) {
        const path = _url.fileURLToPath( url );

        // load schema metadata
        const meta = config.read( path + "/index.json" );

        this.#moduleVersion[module] = meta.version || 0;

        // load schema
        var files = glob.sync( "*.js", { "cwd": path, "nodir": true } );

        for ( const file of files ) {
            if ( file === "index.js" ) continue;

            const version = +file.match( /^(\d+)/g )[0];

            this.#addSchema( module, version, await import( new URL( file, url + "/" ) ) );
        }

        // load patches
        files = glob.sync( "*.js", { "cwd": path + "/patch", "nodir": true } );

        for ( const file of files ) {
            const version = +file.match( /^(\d+)/g )[0];

            this.#addPatch( module, version, await import( new URL( "patch/" + file, url + "/" ) ) );
        }
    }

    async migrate () {
        const res = await this.lock( async dbh => {
            var res;

            // set pgsql advisory lock
            if ( this.isPgsql ) {
                res = await dbh.selectRow( `SELECT pg_advisory_lock(${CONST.SQL_LOCKS.MIGRATION})` );

                if ( !res.ok ) return res;
            }

            try {

                // create migration schema
                res = await dbh.do( `
CREATE TABLE IF NOT EXISTS "${CONST.SQL_MIGRATION_TABLE_NAME}" (
    "module" text PRIMARY KEY NOT NULL,
    "version" int4 NOT NULL
)
            ` );

                if ( !res.ok ) throw res;

                // process modules
                for ( const module of Object.keys( this.#schema ).sort() ) {

                    // get current module version
                    res = await dbh.selectRow( `SELECT "version" FROM "${CONST.SQL_MIGRATION_TABLE_NAME}" WHERE "module" = ?`, [module] );

                    if ( !res.ok ) throw res;

                    let moduleVersion = res.data?.version;

                    // apply full schema
                    if ( this.#schema[module] ) {
                        res = await dbh.begin( async dbh => {
                            for ( const patch of Object.values( this.#schema[module] ).sort( ( a, b ) => a.version - b.version ) ) {

                                // apply functions
                                this.#applyFunctions( dbh, patch );

                                // apply patch
                                if ( moduleVersion == null ) await this.#applyPatch( dbh, patch );

                                // apply types
                                await this.#applyTypes( dbh, patch );
                            }

                            if ( moduleVersion == null ) {
                                moduleVersion = this.#moduleVersion[module];

                                // update module version
                                const res = await dbh.do( `INSERT INTO "${CONST.SQL_MIGRATION_TABLE_NAME}" ("module", "version") VALUES (?, ?) ON CONFLICT ("module") DO UPDATE SET "version" = ?`, [module, moduleVersion, moduleVersion] );

                                if ( !res.ok ) throw res;
                            }
                        } );

                        if ( !res.ok ) throw res;
                    }

                    // apply schema patches
                    if ( this.#patch[module] ) {
                        for ( const patch of Object.values( this.#patch[module] ).sort( ( a, b ) => a.version - b.version ) ) {
                            res = await dbh.begin( async dbh => {
                                let updated;

                                // apply functions
                                this.#applyFunctions( dbh, patch );

                                // apply patch
                                if ( patch.version > moduleVersion ) {
                                    await this.#applyPatch( dbh, patch );

                                    moduleVersion = patch.version;
                                    updated = true;
                                }

                                // apply types
                                await this.#applyTypes( dbh, patch );

                                // update module version
                                if ( updated ) {
                                    const res = await dbh.do( `INSERT INTO "${CONST.SQL_MIGRATION_TABLE_NAME}" ("module", "version") VALUES (?, ?) ON CONFLICT ("module") DO UPDATE SET "version" = ?`, [module, moduleVersion, moduleVersion] );

                                    if ( !res.ok ) throw res;
                                }
                            } );

                            if ( !res.ok ) throw res;
                        }
                    }
                }

                return result( 200 );
            }
            catch ( e ) {
                res = result.catch( e );
            }

            // remove pgsql advisory lock
            if ( this.isPgsql ) {
                const res = await dbh.selectRow( `SELECT pg_advisory_unlock(${CONST.SQL_LOCKS.MIGRATION})` );
                if ( !res.ok ) return res;
            }

            return res;
        } );

        // cleanup
        this.#moduleVersion = {};
        this.#schema = {};
        this.#patch = {};

        return res;
    }

    #addSchema ( module, version, patch ) {
        this.#schema[module] ||= {};

        if ( this.#schema[module][version] ) throw `Schema patch version "${version}" for module "${module}" is already exists`;

        this.#schema[module][version] = { module, version, patch };
    }

    #addPatch ( module, version, patch ) {
        this.#patch[module] ||= {};

        if ( this.#patch[module][version] ) throw `Schema patch id "${version}" for module "${module}" is already exists`;

        this.#patch[module][version] = { module, version, patch };
    }

    #applyFunctions ( dbh, patch ) {
        if ( !this.isSqlite ) return;

        const functions = patch.patch.functions;

        if ( !functions ) return;

        try {
            for ( const name in functions ) {
                dbh.sqlite.function( name, functions[name] );
            }
        }
        catch ( e ) {
            throw result( [500, `Error applying functions for module "${patch.module}", patch "${patch.version}": ` + e] );
        }
    }

    async #applyPatch ( dbh, patch ) {
        const action = patch.patch.default;

        if ( !action ) return;

        var res;

        if ( typeof action === "function" ) {
            try {
                res = result.try( await action( dbh ) );
            }
            catch ( e ) {
                res = result.catch( e );
            }
        }
        else {
            res = await dbh.exec( action );
        }

        if ( !res.ok ) throw result( [500, `Error applying patch for module "${patch.module}", patch "${patch.version}": ` + res.statusText] );
    }

    async #applyTypes ( dbh, patch ) {
        const types = patch.patch.types;

        if ( !types ) return;

        for ( const name in types ) {
            const res = await dbh.addType( name, types[name] );

            if ( !res.ok ) throw result( [500, `Error applying types for module "${patch.module}", patch "${patch.version}": ` + res.statusText] );
        }
    }
}
