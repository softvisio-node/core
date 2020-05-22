const b64 = exports;

b64.toB64 = function ( unencoded ) {
    return new Buffer( unencoded || "" ).toString( "base64" );
};

b64.fromB64 = function ( encoded ) {
    return new Buffer( encoded || "", "base64" ).toString( "utf8" );
};

b64.toB64u = function ( unencoded ) {
    var encoded = b64.toB64( unencoded );

    return encoded.replace( "+", "-" ).replace( "/", "_" ).replace( /=+$/, "" );
};

b64.fromB64u = function ( encoded ) {
    encoded = encoded.replace( "-", "+" ).replace( "_", "/" );

    while ( encoded.length % 4 ) encoded += "=";

    return b64.fromB64( encoded );
};
