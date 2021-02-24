require( "./index/browser" );

// URL
const DEFAULT_PORT = {
    "ftp:": 21,
    "gopher:": 70,
    "http:": 80,
    "https:": 443,
    "ws:": 80,
    "wss:": 443,
};

Object.defineProperty( URL.prototype, "defaultPort", {
    "get": function () {
        return DEFAULT_PORT[this.protocol];
    },
} );

// RESULT
const util = require( "util" );
const result = require( "./result" );

result.Result.prototype[util.inspect.custom] = function ( depth, options ) {
    return this.toJSON();
};

global.result = result;
