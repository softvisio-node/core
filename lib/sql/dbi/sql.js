const { IS_SQL } = require( "../../const" );
const { Query } = require( "../dbi" );

class Sql extends Query {
    sql;
    params;
    query; // [query, params]

    constructor ( sql, params ) {
        super();

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

    // TODO cache query only, return query _ params
    getQuery () {
        if ( this.query === undefined ) {
            this.query = this.buildQuery( 0 );
        }

        return this.query;
    }
}

class SqlCondition extends Sql {
    prefix;
    isSubCondition;

    // TODO
    isEmpty () {
        return false;
    }

    buildQuery ( n ) {
        var query = super.buildQuery( n );

        if ( !this.isSubCondition && query ) {
            query[0] = this.prefix + " " + query[0];
        }

        return query;
    }

    and ( query ) {
        query = new SqlCondition( query );

        const rightIsEmpty = query.isEmpty();

        if ( !rightIsEmpty ) {
            const leftIsEmpty = this.isEmpty();

            // copy right condition
            if ( leftIsEmpty ) {
                this.sql = [query];
            }

            // merge conditions
            else {
                this.sql.unshift( "(" );

                this.sql.push( ") AND (", query, ")" );

                query.isSubCondition = true;
            }
        }

        return this;
    }

    or ( query ) {
        query = new SqlCondition( query );

        const rightIsEmpty = query.isEmpty();

        if ( !rightIsEmpty ) {
            const leftIsEmpty = this.isEmpty();

            // copy right condition
            if ( leftIsEmpty ) {
                this.sql = [query];
            }

            // merge conditions
            else {
                this.sql.unshift( "(" );

                this.sql.push( ") OR (", query, ")" );

                query.isSubCondition = true;
            }
        }

        return this;
    }
}

function sql ( query, ...params ) {
    return new Sql( query, params );
}

module.exports = sql;
module.exports.Query = Query;
module.exports.Sql = Sql;
module.exports.SqlCondition = SqlCondition;
