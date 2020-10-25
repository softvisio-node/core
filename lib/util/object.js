function objectIs ( object, type ) {
    const CONST = require( "../const" );

    return typeof object === "object" && object.constructor[CONST[type]];
}

module.exports = {
    objectIsCountry ( object ) {
        return objectIs( object, "OBJECT_ID_COUNTRY" );
    },

    objectIsGoogleDomain ( object ) {
        return objectIs( object, "OBJECT_ID_GOOGLE_DOMAIN" );
    },

    objectIsMixin ( object ) {
        const CONST = require( "../const" );

        return object[CONST.OBJECT_ID_MIXIN];
    },

    objectIsResult ( object ) {
        return objectIs( object, "OBJECT_ID_RESULT" );
    },

    objectIsApp ( object ) {
        return objectIs( object, "OBJECT_ID_APP" );
    },

    objectIsSqlQuery ( object ) {
        return objectIs( object, "OBJECT_ID_SQL_QUERY" );
    },
};
