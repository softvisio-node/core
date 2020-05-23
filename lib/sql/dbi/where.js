const { SqlCondition } = require( "./sql" );

module.exports = function ( query, ...params ) {
    return new Where( query, params );
};

class Where extends SqlCondition {
    prefix = "WHERE";
}
