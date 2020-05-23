const { IS_SQL } = require( "../const" );
// const { "v1": uuidv1 } = require( "uuid" );

class Sql {
    static [IS_SQL] = true;

    sql;
    params;

    query;

    constructor ( sql, params ) {
        // called as sql`...`
        if ( Array.isArray( sql ) ) {
            this.sql = sql;
            this.params = params;
        }

        // called as sql(sql`...`)
        else if ( sql.constructor[IS_SQL] ) {
            this.sql = [sql];
            this.params = [];
        }

        // called as sql("...")
        else {
            this.sql = [sql];
            this.params = [];
        }
    }

    getPrefix () {
        return "";
    }

    buildQuery ( n ) {
        const buf = [],
            params = [];

        for ( let idx = 0; idx < this.sql.length; idx++ ) {
            if ( this.sql[idx].constructor[IS_SQL] ) {
                const query = this.sql[idx].buildQuery( n );

                if ( query ) {
                    buf.push( query[0] );

                    params.push( ...query[1] );

                    n += query[1].length;
                }
            }
            else {
                const sql = this.sql[idx].trim();

                if ( sql !== "" ) buf.push( sql );
            }

            if ( idx < this.params.length ) {
                if ( this.params[idx].constructor[IS_SQL] ) {
                    const query = this.params[idx].buildQuery( n );

                    if ( query ) {
                        buf.push( query[0] );

                        params.push( ...query[1] );

                        n += query[1].length;
                    }
                }
                else {
                    buf.push( "$" + ++n );

                    params.push( this.params[idx] );
                }
            }
        }

        if ( buf.length ) {
            if ( this.getPrefix() ) buf.unshift( this.getPrefix() );

            return [buf.join( " " ), params];
        }
    }

    getQuery () {
        if ( this.query == null ) {
            this.query = this.buildQuery( 0 );
        }

        return this.query;
    }

    getParams () {
        return this.params;
    }
}

function sql ( query, ...params ) {
    return new Sql( query, params );
}

module.exports = sql;
module.exports.Sql = Sql;
