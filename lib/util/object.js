function objectIs ( object, type ) {
    const CONST = require( "../const" );

    return typeof object === "object" && object.constructor[CONST[type]];
}

module.exports = {
    objectIsApp ( object ) {
        return objectIs( object, "OBJECT_ID_APP" );
    },

    objectIsSqlQuery ( object ) {
        return objectIs( object, "OBJECT_ID_SQL_QUERY" );
    },
};
