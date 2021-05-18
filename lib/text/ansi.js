import ansi from "ansi-colors";

export default ansi;

ansi.theme( {
    "hl": ansi.bold.white,
    "dim": ansi.gray,
    "ok": ansi.bgGreen.bold.white,
    "warn": ansi.bgYellow.bold.white,
    "error": ansi.bgRed.bold.white,
} );

// eslint-disable-next-line no-control-regex
const ANSI_REGEXP = new RegExp( /\x1b\[.*?m/, "g" );
const ANSI_RESET = "\x1b[39m\x1b[22m\u001b[49m";

ansi.remove = function remove ( string ) {
    if ( typeof string !== "string" ) return string;

    if ( string === "" ) return "";

    return string.replaceAll( ANSI_REGEXP, "" );
};

ansi.getCodes = function getCodes ( string ) {
    if ( typeof string !== "string" ) return string;

    if ( string === "" ) return "";

    return [...string.matchAll( ANSI_REGEXP )].map( match => match[0] ).join( "" );
};

ansi.reset = function reset ( string ) {
    if ( typeof string !== "string" ) return string;

    return string + ANSI_RESET;
};
