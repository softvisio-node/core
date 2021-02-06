require( "@softvisio/core/result" );

// STRING
String.prototype.quotemeta = function () {
    return this.replace( /[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&" );
};

// ARRAY
Array.prototype.randomIndex = function () {
    if ( !this.length ) return;

    return Math.floor( Math.random() * this.length );
};

Array.prototype.randomValue = function () {
    if ( !this.length ) return;

    return this[Math.floor( Math.random() * this.length )];
};

// OBJECT
Object.prototype.size = function ( object ) {
    return this.keys( object ).length;
};

Object.prototype.isPlain = function ( object ) {
    return object instanceof Object && object.constructor === Object;
};

Object.prototype.isEmpty = function ( object ) {
    var name;

    for ( name in object ) {
        return false;
    }

    return true;
};

Object.prototype.randomKey = function ( object ) {
    return this.keys( object ).randomValue();
};

Object.prototype.randomValue = function ( object ) {
    return this.values( object ).randomValue();
};

// BIGINT
BigInt.prototype.toJSON = function () {
    return this.toString();
};
