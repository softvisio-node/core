module.exports.freeze = function freeze ( obj ) {
    return new Proxy( Object.freeze( obj ), {
        get ( obj, prop ) {
            if ( !Object.prototype.hasOwnProperty.call( obj, prop ) ) throw Error( `Constant "${prop}" is not defined.` );

            return obj[prop];
        },

        set ( obj, prop, value ) {
            throw Error( `Unable to modify constant "${prop}".` );
        },
    } );
};

module.exports.IS_MIXIN = Symbol();
