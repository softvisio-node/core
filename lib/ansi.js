const ansi = require( "ansi-colors" );

ansi.theme( {
    "hl": ansi.bold.white,
    "ok": ansi.bgGreen.bold.white,
    "warn": ansi.bgYellow.bold.white,
    "error": ansi.bgRed.bold.white,
} );

module.exports = ansi;
