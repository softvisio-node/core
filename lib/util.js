module.exports.sleep = async function ( timeout ) {
    return new Promise( ( resolve ) => setTimeout( resolve, timeout ) );
};

module.exports.isArray = Array.isArray;

module.exports.isDate = function ( obj ) {
    return toString.call( obj ) === "[object Date]";
};

module.exports.isPlainObject = function ( value ) {
    return value instanceof Object && value.constructor === Object;
};

module.exports.isEmptyObject = function ( obj ) {
    var name;

    for ( name in obj ) {
        return false;
    }

    return true;
};
