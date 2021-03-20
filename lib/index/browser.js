// String
String.prototype.quotemeta = function () {
    return this.replace( /[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&" );
};

// Array
Array.prototype.randomKey = function () {
    if ( !this.length ) return;

    return Math.floor( Math.random() * this.length );
};

Array.prototype.randomValue = function () {
    if ( !this.length ) return;

    return this[Math.floor( Math.random() * this.length )];
};

// Object
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

// BigInt
BigInt.prototype.toJSON = function () {
    return this.toString();
};

// ArrayBuffer
ArrayBuffer.prototype.toJSON = function () {
    return btoa( String.fromCharCode( ...new Uint8Array( this ) ) );
};

Uint8Array.prototype.toJSON = function () {
    return this.buffer.toJSON();
};

Uint16Array.prototype.toJSON = function () {
    return this.buffer.toJSON();
};

Uint32Array.prototype.toJSON = function () {
    return this.buffer.toJSON();
};

Uint8ClampedArray.prototype.toJSON = function () {
    return this.buffer.toJSON();
};

Int8Array.prototype.toJSON = function () {
    return this.buffer.toJSON();
};

Int16Array.prototype.toJSON = function () {
    return this.buffer.toJSON();
};

Int32Array.prototype.toJSON = function () {
    return this.buffer.toJSON();
};

Float32Array.prototype.toJSON = function () {
    return this.buffer.toJSON();
};

Float64Array.prototype.toJSON = function () {
    return this.buffer.toJSON();
};

DataView.prototype.toJSON = function () {
    return this.buffer.toJSON();
};
