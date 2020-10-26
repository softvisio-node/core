const CONST = require( "../const" );

function objectIs ( object, type ) {
    return typeof object === "object" && object.constructor[type];
}

module.exports = {
    objectIsApp ( object ) {
        return objectIs( object, CONST.OBJECT_IS_APP );
    },

    objectIsSqlQuery ( object ) {
        return objectIs( object, CONST.OBJECT_IS_SQL_QUERY );
    },
};
