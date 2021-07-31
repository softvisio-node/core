// BigInt
Object.defineProperty( BigInt.prototype, "toJSON", {
    "configurable": true,
    "writable": true,
    value () {
        return this.toString();
    },
} );

/* disabled
// Int8 Array
Object.defineProperty( Int8Array.prototype, "toJSON", {
    "configurable": true,
    "writable": true,
    value () {
        return this.buffer.toJSON();
    },
} );

Object.defineProperty( Uint8Array.prototype, "toJSON", {
    "configurable": true,
    "writable": true,
    value () {
        return this.buffer.toJSON();
    },
} );

Object.defineProperty( Uint8ClampedArray.prototype, "toJSON", {
    "configurable": true,
    "writable": true,
    value () {
        return this.buffer.toJSON();
    },
} );

// Int16 Array
Object.defineProperty( Int16Array.prototype, "toJSON", {
    "configurable": true,
    "writable": true,
    value () {
        return this.buffer.toJSON();
    },
} );

Object.defineProperty( Uint16Array.prototype, "toJSON", {
    "configurable": true,
    "writable": true,
    value () {
        return this.buffer.toJSON();
    },
} );

// Int32 Array
Object.defineProperty( Int32Array.prototype, "toJSON", {
    "configurable": true,
    "writable": true,
    value () {
        return this.buffer.toJSON();
    },
} );

Object.defineProperty( Uint32Array.prototype, "toJSON", {
    "configurable": true,
    "writable": true,
    value () {
        return this.buffer.toJSON();
    },
} );

// Float Array
Object.defineProperty( Float32Array.prototype, "toJSON", {
    "configurable": true,
    "writable": true,
    value () {
        return this.buffer.toJSON();
    },
} );

Object.defineProperty( Float64Array.prototype, "toJSON", {
    "configurable": true,
    "writable": true,
    value () {
        return this.buffer.toJSON();
    },
} );

// BigInt64 Array
Object.defineProperty( BigInt64Array.prototype, "toJSON", {
    "configurable": true,
    "writable": true,
    value () {
        return this.buffer.toJSON();
    },
} );

Object.defineProperty( BigUint64Array.prototype, "toJSON", {
    "configurable": true,
    "writable": true,
    value () {
        return this.buffer.toJSON();
    },
} );

// DataView
Object.defineProperty( DataView.prototype, "toJSON", {
    "configurable": true,
    "writable": true,
    value () {
        return this.buffer.toJSON();
    },
} );
*/
