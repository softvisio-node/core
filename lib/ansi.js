const ansi = require( "ansi-colors" );

ansi.theme( {
    "hl": ansi.bold.white,
    "dim": ansi.gray,
    "ok": ansi.bgGreen.bold.white,
    "warn": ansi.bgYellow.bold.white,
    "error": ansi.bgRed.bold.white,
} );

module.exports = ansi;

// eslint-disable-next-line no-control-regex
const ANSI_REGEXP = new RegExp( /\x1b\[.*?m/, "g" );
const ANSI_RESET = "\x1b[39m\x1b[22m\u001b[49m";

module.exports.remove = function ( string ) {
    if ( typeof string !== "string" ) return string;

    if ( string === "" ) return "";

    return string.replaceAll( ANSI_REGEXP, "" );
};

module.exports.getCodes = function ( string ) {
    if ( typeof string !== "string" ) return string;

    if ( string === "" ) return "";

    return [...string.matchAll( ANSI_REGEXP )].map( match => match[0] ).join( "" );
};

module.exports.reset = function ( string ) {
    if ( typeof string !== "string" ) return string;

    return string + ANSI_RESET;
};
