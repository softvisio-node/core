const CONST = require( "../../const" );

function objectIs ( object, type ) {
    return object != null && typeof object === "object" && object.constructor[type];
}

module.exports = {
    objectIsGoogleDomain ( object ) {
        return objectIs( object, CONST.OBJECT_IS_GOOGLE_DOMAIN );
    },

    objectIsMixin ( object ) {
        return object[CONST.OBJECT_IS_MIXIN];
    },
};
