const { SqlCondition } = require( "./sql" );

module.exports = function ( query, ...params ) {
    return new On( query, params );
};

class On extends SqlCondition {
    prefix = "ON";
}
