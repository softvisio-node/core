module.exports.sleep = async function ( timeout ) {
    return new Promise( resolve => setTimeout( resolve, timeout ) );
};

module.exports.getEnvBool = function ( value ) {
    if ( value === 1 || value === true || value === "1" || value === "true" || value === "yes" ) return true;

    return false;
};
