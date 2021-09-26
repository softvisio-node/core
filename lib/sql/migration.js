import glob from "#lib/glob";
import _url from "url";
import * as config from "#lib/config";
import CONST from "#lib/const";

const SQL_MIGRATION_TABLE_NAME = "__migration__";
const SQL_MIGRATION_DEFAULT_MODULE = "main";

export default Super =>
    class DBHMigration extends Super {
        #moduleVersion = {};
        #schema = {};
        #patch = {};

        // public
        async loadSchema ( url, module = SQL_MIGRATION_DEFAULT_MODULE ) {
            const path = _url.fileURLToPath( url );

            // load schema index
            const meta = config.read( path + "/index.json" );

            if ( meta.patch == null ) throw `DB schema patch is required`;
            this.#moduleVersion[module] = meta.patch;

            // check type
            if ( !meta.type ) throw `DB schema type is required`;
            const type = new Set( Array.isArray( meta.type ) ? meta.type : [meta.type] );
            if ( this.isSQLite && !type.has( "sqlite" ) ) throw `DB schema type is not compatible with SQLite`;
            if ( this.isPgSQL && !type.has( "pgsql" ) ) throw `DB schema type is not compatible PgSQL`;

            // load schema
            var files = glob.sync( "*.js", { "cwd": path, "nodir": true } );

            for ( const file of files ) {
                const version = Number( file.match( /^(\d+)/g )[0] );

                this.#addSchema( module, version, await import( new URL( file, url + "/" ) ) );
            }

            // load patches
            files = glob.sync( "*.js", { "cwd": path + "/patch", "nodir": true } );

            for ( const file of files ) {
                const version = Number( file.match( /^(\d+)/g )[0] );

                this.#addPatch( module, version, await import( new URL( "patch/" + file, url + "/" ) ) );
            }
        }

        async migrate () {
            var res;

            if ( this.isSQLite ) res = this.#migrateSync();
            else res = await this.#migrateAsync();

            // cleanup
            this.#moduleVersion = {};
            this.#schema = {};
            this.#patch = {};

            return res;
        }

        // private
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
            if ( !this.isSQLite ) return;

            const functions = patch.patch.functions;

            if ( !functions ) return;

            try {
                for ( const name in functions ) {
                    dbh.function( name, functions[name] );
                }
            }
            catch ( e ) {
                throw result( [500, `Error applying functions for module "${patch.module}", patch "${patch.version}": ` + e] );
            }
        }

        async #migrateAsync () {
            return this.lock( async dbh => {
                var res;

                // set pgsql advisory lock
                if ( this.isPgSQL ) {
                    res = await dbh.selectRow( `SELECT pg_advisory_lock(${CONST.SQL_LOCKS.MIGRATION})` );

                    if ( !res.ok ) return res;
                }

                try {

                    // XXX patch, remove
                    res = await dbh.exec( `
ALTER TABLE IF EXISTS "__migration" ALTER COLUMN "version" RENAME TO "patch";
ALTER TABLE IF EXISTS "__migration" RENAME TO "${SQL_MIGRATION_TABLE_NAME}";
            ` );
                    if ( !res.ok ) throw res;

                    // create migration schema
                    res = await dbh.do( `
CREATE TABLE IF NOT EXISTS "${SQL_MIGRATION_TABLE_NAME}" (
    "module" text PRIMARY KEY NOT NULL,
    "patch" int4 NOT NULL
)
            ` );

                    if ( !res.ok ) throw res;

                    // process modules
                    for ( const module of Object.keys( this.#schema ).sort() ) {

                        // get current module version
                        res = await dbh.selectRow( `SELECT "patch" FROM "${SQL_MIGRATION_TABLE_NAME}" WHERE "module" = ?`, [module] );
                        if ( !res.ok ) throw res;

                        let moduleVersion = res.data?.patch;

                        // apply full schema
                        if ( this.#schema[module] ) {
                            res = await dbh.begin( async dbh => {
                                for ( const patch of Object.values( this.#schema[module] ).sort( ( a, b ) => a.version - b.version ) ) {

                                    // apply functions
                                    this.#applyFunctions( dbh, patch );

                                    // apply patch
                                    if ( moduleVersion == null ) await this._applyPatch( dbh, patch );

                                    // apply types
                                    await this._applyTypes( dbh, patch );
                                }

                                if ( moduleVersion == null ) {
                                    moduleVersion = this.#moduleVersion[module];

                                    // update module version
                                    const res = await dbh.do( `INSERT INTO "${SQL_MIGRATION_TABLE_NAME}" ("module", "patch") VALUES (?, ?) ON CONFLICT ("module") DO UPDATE SET "patch" = ?`, [module, moduleVersion, moduleVersion] );

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
                                        await this._applyPatch( dbh, patch );

                                        moduleVersion = patch.version;
                                        updated = true;
                                    }

                                    // apply types
                                    await this._applyTypes( dbh, patch );

                                    // update module version
                                    if ( updated ) {
                                        const res = await dbh.do( `INSERT INTO "${SQL_MIGRATION_TABLE_NAME}" ("module", "patch") VALUES (?, ?) ON CONFLICT ("module") DO UPDATE SET "patch" = ?`, [module, moduleVersion, moduleVersion] );

                                        if ( !res.ok ) throw res;
                                    }
                                } );

                                if ( !res.ok ) throw res;
                            }
                        }
                    }

                    res = result( 200 );
                }
                catch ( e ) {
                    res = result.catch( e );
                }

                // remove pgsql advisory lock
                if ( this.isPgSQL ) {
                    const res = await dbh.selectRow( `SELECT pg_advisory_unlock(${CONST.SQL_LOCKS.MIGRATION})` );
                    if ( !res.ok ) return res;
                }

                return res;
            } );
        }

        #migrateSync () {
            const dbh = this;

            var res;

            try {

                // create migration schema
                res = dbh.do( `
CREATE TABLE IF NOT EXISTS "${SQL_MIGRATION_TABLE_NAME}" (
    "module" text PRIMARY KEY NOT NULL,
    "patch" int4 NOT NULL
)
            ` );

                if ( !res.ok ) throw res;

                // process modules
                for ( const module of Object.keys( this.#schema ).sort() ) {

                    // get current module version
                    res = dbh.selectRow( `SELECT "patch" FROM "${SQL_MIGRATION_TABLE_NAME}" WHERE "module" = ?`, [module] );
                    if ( !res.ok ) throw res;

                    let moduleVersion = res.data?.patch;

                    // apply full schema
                    if ( this.#schema[module] ) {
                        res = dbh.begin( dbh => {
                            for ( const patch of Object.values( this.#schema[module] ).sort( ( a, b ) => a.version - b.version ) ) {

                                // apply functions
                                this.#applyFunctions( dbh, patch );

                                // apply patch
                                if ( moduleVersion == null ) this._applyPatch( dbh, patch );

                                // apply types
                                this._applyTypes( dbh, patch );
                            }

                            if ( moduleVersion == null ) {
                                moduleVersion = this.#moduleVersion[module];

                                // update module version
                                const res = dbh.do( `INSERT INTO "${SQL_MIGRATION_TABLE_NAME}" ("module", "patch") VALUES (?, ?) ON CONFLICT ("module") DO UPDATE SET "patch" = ?`, [module, moduleVersion, moduleVersion] );

                                if ( !res.ok ) throw res;
                            }
                        } );

                        if ( !res.ok ) throw res;
                    }

                    // apply schema patches
                    if ( this.#patch[module] ) {
                        for ( const patch of Object.values( this.#patch[module] ).sort( ( a, b ) => a.version - b.version ) ) {
                            res = dbh.begin( dbh => {
                                let updated;

                                // apply functions
                                this.#applyFunctions( dbh, patch );

                                // apply patch
                                if ( patch.version > moduleVersion ) {
                                    this._applyPatch( dbh, patch );

                                    moduleVersion = patch.version;
                                    updated = true;
                                }

                                // apply types
                                this._applyTypes( dbh, patch );

                                // update module version
                                if ( updated ) {
                                    const res = dbh.do( `INSERT INTO "${SQL_MIGRATION_TABLE_NAME}" ("module", "patch") VALUES (?, ?) ON CONFLICT ("module") DO UPDATE SET "patch" = ?`, [module, moduleVersion, moduleVersion] );

                                    if ( !res.ok ) throw res;
                                }
                            } );

                            if ( !res.ok ) throw res;
                        }
                    }
                }

                res = result( 200 );
            }
            catch ( e ) {
                res = result.catch( e );
            }

            return res;
        }
    };
