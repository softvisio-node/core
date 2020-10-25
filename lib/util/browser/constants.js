module.exports.constants = function ( obj ) {
    return new Proxy( obj, {
        get ( obj, prop ) {
            if ( prop === "__esModule" ) return obj[prop];

            if ( !Object.prototype.hasOwnProperty.call( obj, prop ) ) throw Error( `Constant "${prop}" is not defined.` );

            return obj[prop];
        },

        set ( obj, prop, value ) {
            throw Error( `Unable to modify constant "${prop}".` );
        },
    } );
};
