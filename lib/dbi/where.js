const { Sql } = require( "./sql" );

module.exports = function ( query, ...params ) {
    return new Where( query, params );
};

class Where extends Sql {
    getPrefix () {
        return "WHERE";
    }

    // TODO check if empty
    and () {
        this.sql.unshift( "(" );

        this.sql.push( ") AND (", ...arguments, ")" );

        return this;
    }

    // TODO check if empty
    or () {
        this.sql.unshift( "(" );

        this.sql.push( ") OR (", ...arguments, ")" );

        return this;
    }
}
