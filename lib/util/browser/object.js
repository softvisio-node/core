const CONST = require( "../../const" );

function objectIs ( object, type ) {
    return typeof object === "object" && object.constructor[type];
}

module.exports = {
    objectIsCountry ( object ) {
        return objectIs( object, CONST.OBJECT_IS_COUNTRY );
    },

    objectIsGoogleDomain ( object ) {
        return objectIs( object, CONST.OBJECT_IS_GOOGLE_DOMAIN );
    },

    objectIsMixin ( object ) {
        return object[CONST.OBJECT_IS_MIXIN];
    },

    objectIsResult ( object ) {
        return objectIs( object, CONST.OBJECT_IS_RESULT );
    },
};
