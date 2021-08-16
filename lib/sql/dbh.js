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
    async begin ( mode, func ) {
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
                res = result.try( ( await func( dbh ) ) ?? result( 200 ) );

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

            const id = file.match( /^(\d+)/g )[0];

            this.#addSchema( id, module, await import( new URL( file, url + "/" ) ) );
        }

        // load patches
        files = glob.sync( "*.js", { "cwd": path + "/patch", "nodir": true } );

        for ( const file of files ) {
            const id = file.match( /^(\d+)/g )[0];

            this.#addPatch( id, module, await import( new URL( "patch/" + file, url + "/" ) ) );
        }
    }

    async migrate () {
        const res = await this.begin( async dbh => {
            if ( this.isPgsql ) await dbh.selectRow( `SELECT pg_advisory_xact_lock(${CONST.SQL_LOCKS.MIGRATION})` );

            // create migration schema
            let res = await dbh.do( `
CREATE TABLE IF NOT EXISTS "${CONST.SQL_MIGRATION_TABLE_NAME}" (
    "module" text PRIMARY KEY NOT NULL,
    "version" int4 NOT NULL
)
            ` );

            if ( !res.ok ) throw res;

            for ( const module of Object.keys( this.#schema ).sort() ) {

                // get current module version
                res = await dbh.selectRow( `SELECT "version" FROM "${CONST.SQL_MIGRATION_TABLE_NAME}" WHERE "module" = ?`, [module] );

                if ( !res.ok ) throw res;

                let moduleVersion = res.data?.version;
                const initialModuleVersion = moduleVersion;

                // process schema
                if ( this.#schema[module] ) {
                    for ( const version of Object.keys( this.#schema[module] ).sort( ( a, b ) => a - b ) ) {
                        const patch = this.#schema[module][version];

                        // apply functions
                        this.#applyFunctions( dbh, patch );

                        // apply patch
                        if ( moduleVersion == null ) await this.#applyPatch( dbh, patch );

                        // apply types
                        await this.#applyTypes( dbh, patch );
                    }

                    if ( moduleVersion == null ) moduleVersion = this.#moduleVersion[module];
                }

                // process schema patches
                if ( this.#patch[module] ) {
                    for ( const version of Object.keys( this.#patch[module] ).sort( ( a, b ) => a - b ) ) {
                        const patch = this.#patch[module][version];

                        // apply functions
                        this.#applyFunctions( dbh, patch );

                        // apply patch
                        if ( patch.version > moduleVersion ) {
                            await this.#applyPatch( dbh, patch );

                            moduleVersion = version;
                        }

                        // apply types
                        await this.#applyTypes( dbh, patch );
                    }
                }

                // update schema module version
                if ( moduleVersion !== initialModuleVersion ) {
                    res = await dbh.do( `INSERT INTO "${CONST.SQL_MIGRATION_TABLE_NAME}" ("module", "version") VALUES (?, ?) ON CONFLICT ("module") DO UPDATE SET "version" = ?`, [module, moduleVersion, moduleVersion] );

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
        this.#schema[module] ||= {};

        if ( this.#schema[module][id] ) throw `Schema patch id "${id}" for module "${module}" is already exists`;

        this.#schema[module][id] = patch;
    }

    #addPatch ( id, module, patch ) {
        this.#patch[module] ||= {};

        if ( this.#patch[module][id] ) throw `Schema patch id "${id}" for module "${module}" is already exists`;

        this.#patch[module][id] = patch;
    }

    #applyFunctions ( dbh, patch ) {
        if ( !this.isSqlite ) return;

        if ( !patch.functions ) return;

        try {
            for ( const name in patch.functions ) {
                dbh.sqlite.function( name, patch.functions[name] );
            }
        }
        catch ( e ) {
            throw result( [500, `Error applying functions for module "${patch.module}", patch "${patch.version}": ` + e] );
        }
    }

    async #applyPatch ( dbh, patch ) {
        if ( !patch.default ) return;

        var res;

        if ( typeof patch.default === "function" ) {
            try {
                res = result.try( await patch.default( dbh ) );
            }
            catch ( e ) {
                res = result.catch( e );
            }
        }
        else {
            res = await dbh.exec( patch.default );
        }

        if ( !res.ok ) throw result( [500, `Error applying patch for module "${patch.module}", patch "${patch.version}": ` + res.statusText] );
    }

    async #applyTypes ( dbh, patch ) {
        if ( !patch.types ) return;

        for ( const name in patch.types ) {
            const res = await dbh.addType( name, patch.types[name] );

            if ( !res.ok ) throw result( [500, `Error applying types for module "${patch.module}", patch "${patch.version}": ` + res.statusText] );
        }
    }
}
