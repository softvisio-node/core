const { "default": bytesToUuid } = require( "uuid/dist/bytesToUuid" );

module.exports.sleep = async function ( timeout ) {
    return new Promise( ( resolve ) => setTimeout( resolve, timeout ) );
};

module.exports.isArray = Array.isArray;

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

module.exports.fromBase64u = function ( str ) {
    str = str.replace( "-", "+" ).replace( "_", "/" );

    while ( str.length % 4 ) str += "=";

    return Buffer.from( str, "base64" );
};

module.exports.toBase64u = function ( val ) {
    if ( Buffer.isBuffer( val ) ) val = val.toString( "base64" );

    return val.replace( "+", "-" ).replace( "/", "_" ).replace( /=+$/, "" );
};

module.exports.bytesToUuid = bytesToUuid;
