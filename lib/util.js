module.exports = require( "./util/browser" );

module.exports.fromBase64u = function ( str ) {
    str = str.replace( /-/g, "+" ).replace( /_/g, "/" );

    str += "===".slice( ( str.length + 3 ) % 4 );

    return Buffer.from( str, "base64" );
};

module.exports.toBase64u = function ( val ) {
    if ( Buffer.isBuffer( val ) ) val = val.toString( "base64" );

    return val.replace( /\+/g, "-" ).replace( /\//g, "_" ).replace( /=+$/, "" );
};

module.exports.bytesToUuid = require( "./util/bytes-to-uuid" );
