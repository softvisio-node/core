const { SqlCondition } = require( "./sql" );

module.exports = function ( query, ...params ) {
    return new Having( query, params );
};

class Having extends SqlCondition {
    prefix = "HAVING";
}
