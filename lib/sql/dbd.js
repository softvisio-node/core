const result = require( "../result" );
const { isPlainObject } = require( "../util" );
const { createHash } = require( "crypto" );
const { "v1": uuidv1 } = require( "uuid" );
const { SQL } = require( "./dbi" );

const { SQL_MIGRATION_TABLE_NAME, SQL_MIGRATION_DEFAULT_MODULE } = require( "../const" );

class Dbh {
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
            dbh = this._getDbh( true );
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
                res = result.tryResult( ( await func( dbh ) ) || 200 );

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

        if ( !useSavepoint ) this._pushDbh( dbh );

        return res;
    }
}

class DbhPool extends Dbh {
    #patch = {};

    // MIGRATION
    async loadSchema ( path, module = SQL_MIGRATION_DEFAULT_MODULE ) {
        const glob = require( "glob" ),
            files = glob.sync( "**/*.js", { "cwd": path, "nodir": true } );

        if ( !this.#patch[module] ) this.#patch[module] = {};

        for ( const patch of files ) {
            const [id] = [...patch.matchAll( /^(\d+)/g )][0];

            this.addSchemaPatch( id, module, require( path + "/" + patch ) );
        }
    }

    addSchemaPatch ( id, module, patch ) {
        if ( patch == null ) {
            patch = module;
            module = SQL_MIGRATION_DEFAULT_MODULE;
        }

        if ( !this.#patch[module] ) this.#patch[module] = {};

        if ( this.#patch[module][id] ) throw `Schema patch id "${id}" for module "${module}" is already exists`;

        let query, functions;

        if ( isPlainObject( patch ) ) {
            if ( this.isSqlite && patch.sqlite ) {
                if ( isPlainObject( patch.sqlite ) ) {
                    query = patch.sqlite.query;
                    functions = patch.sqlite.functions;
                }
                else query = patch.sqlite;
            }
            else if ( this.isPgsql && patch.pgsql ) {
                if ( isPlainObject( patch.pgsql ) ) {
                    query = patch.pgsql.query;
                }
                else query = patch.pgsql;
            }
            else {
                query = patch.query;
                functions = patch.functions;
            }
        }
        else query = patch;

        // add sqlite functions
        if ( this.isSqlite && functions ) {
            for ( const name in functions ) {
                this.db.function( name, functions[name] );
            }
        }

        if ( !query ) return;

        this.#patch[module][id] = {
            id,
            module,
            query,
            "hash":
                typeof query === "function"
                    ? ""
                    : createHash( "SHA1" )
                        .update( this.isQuery( query ) ? query.getQuery()[0] : query, "utf8" )
                        .digest( "hex" ),
        };
    }

    async migrate () {
        const res = await this.begin( async dbh => {

            // create patch table
            let res = await dbh.do( `
CREATE TABLE IF NOT EXISTS "${SQL_MIGRATION_TABLE_NAME}" (
    "module" TEXT NOT NULL,
    "id" INT4 NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hash" TEXT NOT NULL,
    PRIMARY KEY ("module", "id")
)
            ` );

            if ( !res.ok ) throw res;

            for ( const module of Object.keys( this.#patch ).sort() ) {
                for ( const id of Object.keys( this.#patch[module] ).sort( ( a, b ) => {
                    return a - b;
                } ) ) {
                    res = await dbh.selectRow( `SELECT "id", "hash" FROM "${SQL_MIGRATION_TABLE_NAME}" WHERE "module" = ? AND "id" = ?`, [module, id] );

                    if ( !res.ok ) throw res;

                    // patch is already applied
                    if ( res.data ) continue;

                    // apply patch
                    if ( typeof this.#patch[module][id].query === "function" ) {
                        try {
                            res = result.tryResult( await this.#patch[module][id].query( dbh ) );
                        }
                        catch ( e ) {
                            res = result.catchResult( e );
                        }
                    }
                    else {
                        res = await dbh.exec( this.#patch[module][id].query );
                    }

                    if ( !res.ok ) throw res;

                    // register patch
                    res = await dbh.do( `INSERT INTO "${SQL_MIGRATION_TABLE_NAME}" ("module", "id", "hash") VALUES (?, ?, ?)`, [module, id, this.#patch[module][id].hash] );

                    if ( !res.ok ) throw res;
                }
            }

            return result( 200 );
        } );

        this.#patch = {};

        return res;
    }

    // async addTypes ( types ) {
    //     var _types = await this.#getTypes();

    //     const spec = {};

    //     for ( const type in types ) {
    //         const names = [type, ...( types[type].aliases || [] )];

    //         for ( const name of names ) {
    //             const oid = _types[name];

    //             if ( !oid ) return result( [400, `Type name "${name}" wasn't found`] );
    //         }
    //     }
    // }

    async #getTypes () {
        var oids = await this.selectAll( `SELECT "oid", "typname" FROM "pg_type"` );

        if ( !oids.ok ) return {};

        oids = Object.fromEntries( oids.data.map( row => [row.typname, row.oid] ) );

        return oids;
    }
}

function connect ( url, options ) {
    url = new URL( url );

    var Class;

    if ( url.protocol === "pgsql:" ) {
        Class = require( "./dbd/pgsql" );
    }
    else if ( url.protocol === "sqlite:" ) {
        Class = require( "./dbd/sqlite" );
    }
    else {
        throw `Invalid sql protocol`;
    }

    return new Class( url, options );
}

module.exports.connect = connect;
module.exports.Dbh = Dbh;
module.exports.DbhPool = DbhPool;
