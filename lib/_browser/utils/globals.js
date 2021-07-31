import "./_globals.js";

/* disabled
// ArrayBuffer
Object.defineProperty( ArrayBuffer.prototype, "toJSON", {
    "configurable": true,
    "writable": true,
    value () {
        return btoa( String.fromCharCode( ...new Uint8Array( this ) ) );
    },
} );

Object.defineProperty( SharedArrayBuffer.prototype, "toJSON", {
    "configurable": true,
    "writable": true,
    value () {
        return btoa( String.fromCharCode( ...new Uint8Array( this ) ) );
    },
} );
*/
