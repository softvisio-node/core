module.exports = { ...require( "./browser/object" ) };

module.exports.constants = function ( obj ) {
    return new Proxy( obj, {
        get ( obj, prop ) {
            if ( prop === "__esModule" ) return obj[prop];

            if ( !Object.prototype.hasOwnProperty.call( obj, prop ) ) throw Error( `Constant "${prop}" is not defined.` );

            return obj[prop];
        },

        set ( obj, prop, value ) {
            throw Error( `Unable to modify constant "${prop}".` );
        },
    } );
};

module.exports.sleep = async function ( timeout ) {
    return new Promise( resolve => setTimeout( resolve, timeout ) );
};

module.exports.isDate = function ( obj ) {
    return toString.call( obj ) === "[object Date]";
};

module.exports.isPlainObject = function ( value ) {
    return value instanceof Object && value.constructor === Object;
};

module.exports.isEmptyObject = function ( obj ) {
    var name;

    for ( name in obj ) {
        return false;
    }

    return true;
};

module.exports.toMessagePack = require( "notepack.io" ).encode;

module.exports.fromMessagePack = require( "notepack.io" ).decode;

module.exports.quotemeta = function ( str ) {
    return str.replace( /[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&" );
};
