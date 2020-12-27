const proxy = {
    get ( obj, prop ) {
        if ( prop === "__esModule" ) return obj[prop];

        if ( !Object.prototype.hasOwnProperty.call( obj, prop ) ) throw Error( `Constant "${prop}" is not defined.` );

        return obj[prop];
    },

    set ( obj, prop, value ) {
        throw Error( `Unable to modify constant "${prop}".` );
    },
};

function constants ( object ) {

    // for ( const name in object ) {

    //     // plain object
    //     if ( object[name] instanceof Object && object[name].constructor === Object ) {
    //         object[name] = constants( object[name] );
    //     }
    // }

    return new Proxy( object, proxy );
}

module.exports.constants = constants;
