export { sleep } from "#lib/timers";

// XXX replace with RegExp.escape()
export function quoteMeta ( string ) {
    return string.replaceAll( /[\s#$()*+,.?[\\\]^{|}-]/g, "\\$&" );
}

export function getRandomArrayIndex ( array ) {
    if ( !array.length ) return;

    return Math.floor( Math.random() * array.length );
}

export function getRandomArrayValue ( array ) {
    if ( !array.length ) return;

    return array[ Math.floor( Math.random() * array.length ) ];
}

export function objectIsPlain ( object ) {
    return object instanceof Object && object.constructor === Object;
}

export function freezeObjectRecursively ( object ) {
    if ( object != null && typeof object === "object" ) {
        Object.freeze( object );

        for ( const value of Object.values( object ) ) {
            freezeObjectRecursively( value );
        }
    }

    return object;
}

// XXX not efficient, remove
export function objectIsEmpty ( object ) {
    for ( const name in object ) return false;

    return true;
}

export function objectPick ( object, keys ) {
    return keys.reduce( ( result, key ) => {
        if ( key in object ) result[ key ] = object[ key ];

        return result;
    }, {} );
}

export function objectOmit ( object, keys ) {
    object = { ...object };

    keys.forEach( key => delete object[ key ] );

    return object;
}

export function mergeObjects ( target, ...objects ) {
    for ( const object of objects ) {
        if ( !object ) continue;

        for ( const property in object ) {
            if ( objectIsPlain( object[ property ] ) ) {
                if ( !objectIsPlain( target[ property ] ) ) target[ property ] = {};

                mergeObjects( target[ property ], object[ property ] );
            }
            else if ( object[ property ] === undefined ) {
                delete target[ property ];
            }
            else {
                target[ property ] = object[ property ];
            }
        }
    }

    return target;
}
