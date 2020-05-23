const { Sql } = require( "./sql" );

module.exports = function ( query, ...params ) {
    return new Where( query, params );
};

class Where extends Sql {
    subCondition;

    buildQuery ( n ) {
        var query = super.buildQuery( n );

        if ( !this.subCondition && query ) {
            query[0] = "WHERE " + query[0];
        }

        return query;
    }

    and ( query ) {
        query = new Where( query );

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

                query.subCondition = true;
            }
        }

        return this;
    }

    or ( query ) {
        query = new Where( query );

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

                query.subCondition = true;
            }
        }

        return this;
    }
}
