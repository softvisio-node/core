const res = require( "../result" );
const { IS_SQL, DB_MIGRATION_TABLE_NAME, DB_MIGRATION_DEFAULT_MODULE } = require( "../const" );
const { createHash } = require( "crypto" );

class Dbh {
    url;
    #patch = {};

    constructor ( url ) {
        this.url = url;
    }

    _onError ( e, query ) {
        console.error( `DBI erorr: ${e.message}\nQUERY: ${query}\n${e.stack}` );

        return res( [500, e.message] );
    }

    isQuery ( object ) {
        return object != null && object.constructor[IS_SQL];
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

        query = query.replace( /\?/g, () => {
            if ( idx >= length ) {
                throw Error( `SQL number of passed params is less, than number of place holders in query` );
            }
            else {
                return this.quote( params[idx++] );
            }
        } );

        if ( idx < length ) throw Error( `SQL number of passed params is greater, than number of place holders in query` );

        return query;
    }

    // MIGRATION
    async loadSchema ( path, module = DB_MIGRATION_DEFAULT_MODULE ) {
        const { readTree } = require( "../fs" ),
            files = await readTree( path );

        if ( !this.#patch[module] ) this.#patch[module] = {};

        for ( const patch of files ) {
            const [id] = [...patch.matchAll( /^(\d+)/g )][0];

            this.addSchemaPatch( id, module, require( path + "/" + patch ) );
        }
    }

    addSchemaPatch ( id, module, sql ) {
        if ( sql == null ) {
            sql = module;
            module = DB_MIGRATION_DEFAULT_MODULE;
        }

        if ( !this.#patch[module] ) this.#patch[module] = {};

        if ( this.#patch[module][id] ) throw `Schema patch id "${id}" for module "${module}" is already exists`;

        if ( typeof sql === "object" ) {
            if ( this.isSqlite && sql.sqlite ) {
                sql = sql.sqlite;
            }
            else if ( this.isPgsql && sql.pgsql ) {
                sql = sql.pgsql;
            }
            else {
                throw `Schema patch id "${id}" for module "${module}" has no SQL statement for current database`;
            }
        }

        if ( !sql ) return;

        this.#patch[module][id] = {
            id,
            module,
            sql,
            "hash": createHash( "SHA1" ).update( sql, "utf8" ).digest( "hex" ),
        };
    }

    async migrate () {
        const res = await this.begin( async ( dbh ) => {

            // create patch table
            let res = await dbh.do( `
CREATE TABLE IF NOT EXISTS "${DB_MIGRATION_TABLE_NAME}" (
    "module" TEXT NOT NULL,
    "id" INT4 NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hash" TEXT NOT NULL,
    PRIMARY KEY ("module", "id")
)
            ` );

            if ( !res.isOk() ) throw res;

            for ( const module of Object.keys( this.#patch ).sort() ) {
                for ( const id of Object.keys( this.#patch[module] ).sort( ( a, b ) => {
                    return a - b;
                } ) ) {
                    res = await dbh.selectRow( `SELECT "id", "hash" FROM "${DB_MIGRATION_TABLE_NAME}" WHERE "module" = ? AND "id" = ?`, [module, id] );

                    if ( !res.isOk() ) throw res;

                    // patch is already applied
                    if ( res.data ) continue;

                    // apply patch
                    res = await dbh.do( this.#patch[module][id].sql );

                    if ( !res.isOk() ) throw res;

                    // register patch
                    res = await dbh.do( `INSERT INTO "${DB_MIGRATION_TABLE_NAME}" ("module", "id", "hash") VALUES (?, ?, ?)`, [module, id, this.#patch[module][id].hash] );

                    if ( !res.isOk() ) throw res;
                }
            }

            return 200;
        } );

        this.#patch = {};

        return res;
    }
}

function connect ( url ) {
    url = new URL( url );

    const Class = require( "./dbh/" + url.protocol.slice( 0, -1 ) );

    return new Class( url );
}

module.exports.connect = connect;
module.exports.Dbh = Dbh;
