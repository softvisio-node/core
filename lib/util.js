module.exports.sleep = async function ( timeout ) {
    return new Promise( ( resolve ) => setTimeout( resolve, timeout ) );
};

module.exports.isConstructor = function ( func ) {
    try {
        Reflect.construct( String, [], func );
    }
    catch ( e ) {
        return false;
    }

    return true;
};
