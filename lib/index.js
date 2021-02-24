// STRING
String.prototype.quotemeta = function () {
    return this.replace( /[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&" );
};

// ARRAY
Array.prototype.randomKey = function () {
    if ( !this.length ) return;

    return Math.floor( Math.random() * this.length );
};

Array.prototype.randomValue = function () {
    if ( !this.length ) return;

    return this[Math.floor( Math.random() * this.length )];
};

// OBJECT
Object.isPlain = function ( object ) {
    return object instanceof Object && object.constructor === Object;
};

// XXX not effective, need to remove
Object.isEmpty = function ( object ) {
    var name;

    for ( name in object ) {
        return false;
    }

    return true;
};

Object.pick = function ( object, keys ) {
    return this.fromEntries( this.entries( object ).filter( ( [key] ) => keys.includes( key ) ) );
};

Object.omit = function ( object, keys ) {
    return this.fromEntries( this.entries( object ).filter( ( [key] ) => !keys.includes( key ) ) );
};

// BIGINT
BigInt.prototype.toJSON = function () {
    return this.toString();
};

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
