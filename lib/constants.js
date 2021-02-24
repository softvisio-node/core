module.exports = function constants ( object ) {
    for ( const name in object ) {

        // plain object
        if ( object[name] instanceof Object && object[name].constructor === Object ) {
            object[name] = constants( object[name] );
        }
    }

    return Object.freeze( object );
};
