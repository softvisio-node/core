const { Sql } = require( "./sql" );
const { IS_SQL } = require( "../const" );

module.exports = function ( sql, ...params ) {
    // called as sql`...`
    if ( Array.isArray( sql ) ) {
        const query = new Sql( sql, params );

        return new Limit( query );
    }

    // called as sql(sql`...`, options)
    else if ( sql.constructor[IS_SQL] ) {
        return new Limit( sql, params );
    }

    // called as sql("...", options)
    else {
        return new Limit( sql, params );
    }
};

class Limit extends Sql {
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
            return [buf.join( " " ), params];
        }
        else {
            return null;
        }
    }
}
