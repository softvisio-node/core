import "#lib/_browser/utils/_globals";

/* disabled
// Buffer
Object.defineProperty( Buffer.prototype, "toJSON", {
    "configurable": true,
    "writable": true,
    value () {
        return this.toString( "base64" );
    },
} );

// ArrayBuffer
Object.defineProperty( ArrayBuffer.prototype, "toJSON", {
    "configurable": true,
    "writable": true,
    value () {
        return Buffer.from( this ).toJSON();
    },
} );

Object.defineProperty( SharedArrayBuffer.prototype, "toJSON", {
    "configurable": true,
    "writable": true,
    value () {
        return Buffer.from( this ).toJSON();
    },
} );
*/
