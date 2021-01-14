module.exports = { ...require( "./browser/constants" ), ...require( "./browser/object" ) };

module.exports.sleep = async function ( timeout ) {
    return new Promise( resolve => setTimeout( resolve, timeout ) );
};

module.exports.isDate = function ( object ) {
    return toString.call( object ) === "[object Date]";
};

module.exports.isPlainObject = function ( object ) {
    return object instanceof Object && object.constructor === Object;
};

module.exports.isEmptyObject = function ( object ) {
    var name;

    for ( name in object ) {
        return false;
    }

    return true;
};

module.exports.quotemeta = function ( str ) {
    return str.replace( /[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&" );
};

// SERIALIZERS
BigInt.prototype.toJSON = function () {
    return this.toString();
};

module.exports.toMsgPack = require( "@softvisio/messagepack/encode" );

module.exports.fromMsgPack = require( "@softvisio/messagepack/decode" );
