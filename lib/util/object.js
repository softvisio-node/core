const CONST = require( "../const" );

function objectIs ( object, type ) {
    return object != null && typeof object === "object" && object.constructor[type];
}

module.exports = {
    objectIsSqlQuery ( object ) {
        return objectIs( object, CONST.OBJECT_IS_SQL_QUERY );
    },
};
