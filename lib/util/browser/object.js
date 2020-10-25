const CONST = require( "../../const" );

function objectIs ( object, type ) {
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
        return object[CONST.OBJECT_ID_MIXIN];
    },

    objectIsResult ( object ) {
        return objectIs( object, "OBJECT_ID_RESULT" );
    },
};
