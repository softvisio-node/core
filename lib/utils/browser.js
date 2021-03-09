module.exports.sleep = async function ( timeout ) {
    return new Promise( resolve => setTimeout( resolve, timeout ) );
};

module.exports.getEnvBool = function ( value ) {
    if ( value === true || value === "true" ) return true;

    return false;
};
