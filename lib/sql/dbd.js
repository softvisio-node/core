const { result, parseError, parseResult } = require( "../result" );
const { IS_SQL_QUERY, SQL_MIGRATION_TABLE_NAME, SQL_MIGRATION_DEFAULT_MODULE } = require( "../const" );
const { createHash } = require( "crypto" );
const { "v1": uuidv1 } = require( "uuid" );

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

        return result( [500, e.message] );
    }

    isQuery ( object ) {
        return object != null && object.constructor[IS_SQL_QUERY];
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
                res = parseResult( ( await func( dbh ) ) || 200 );

                // release savepoint
                const tres = await dbh.do( useSavepoint ? `RELEASE SAVEPOINT "${savepointName}"` : "COMMIT" );

                // release failed
                if ( !tres.ok ) res = tres;
            }
            catch ( e ) {
                res = parseError( e );

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

    addSchemaPatch ( id, module, sql ) {
        if ( sql == null ) {
            sql = module;
            module = SQL_MIGRATION_DEFAULT_MODULE;
        }

        if ( !this.#patch[module] ) this.#patch[module] = {};

        if ( this.#patch[module][id] ) throw `Schema patch id "${id}" for module "${module}" is already exists`;

        if ( typeof sql === "object" && !this.isQuery( sql ) ) {
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
            "hash": createHash( "SHA1" )
                .update( this.isQuery( sql ) ? sql.getQuery()[0] : sql, "utf8" )
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
                    res = await dbh.exec( this.#patch[module][id].sql );

                    if ( !res.ok ) throw res;

                    // register patch
                    res = await dbh.do( `INSERT INTO "${SQL_MIGRATION_TABLE_NAME}" ("module", "id", "hash") VALUES (?, ?, ?)`, [module, id, this.#patch[module][id].hash] );

                    if ( !res.ok ) throw res;
                }
            }

            return 200;
        } );

        this.#patch = {};

        return res;
    }
}

function connect ( url, options ) {
    url = new URL( url );

    const Class = require( "./dbd/" + url.protocol.slice( 0, -1 ) );

    return new Class( url, options );
}

module.exports.connect = connect;
module.exports.Dbh = Dbh;
module.exports.DbhPool = DbhPool;
