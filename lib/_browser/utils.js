export async function sleep ( delay, signal ) {
    if ( signal ) {
        if ( signal.aborted ) return;

        return new Promise( resolve => {
            var timeout;

            const onDone = () => {
                clearTimeout( timeout );

                signal.removeEventListener( "abort", onDone );

                resolve();
            };

            signal.addEventListener( "abort", onDone );

            timeout = setTimeout( onDone, delay );
        } );
    }
    else {
        return new Promise( resolve => setTimeout( resolve, delay ) );
    }
}

export function quoteMeta ( string ) {
    return string.replace( /[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&" );
}

export function getRandomArrayIndex ( array ) {
    if ( !array.length ) return;

    return Math.floor( Math.random() * array.length );
}

export function getRandomArrayValue ( array ) {
    if ( !array.length ) return;

    return array[Math.floor( Math.random() * array.length )];
}

export function getRandomBigInt ( min, max ) {
    if ( min === max ) return min;

    max = max - min + 1n;

    var rand = [],
        digits = ( max.toString().length / 9 + 2 ) | 0;

    while ( digits-- ) {
        rand.push( ( "" + ( ( Math.random() * 1000000000 ) | 0 ) ).padStart( 9, "0" ) );
    }

    return min + ( BigInt( rand.join( "" ) ) % max );
}

export function getRandomWeight ( items, { totalWeight } = {} ) {
    var max = 0;

    totalWeight ||= 0;

    // calculate total weight
    if ( !totalWeight ) {
        for ( const item of items ) {
            if ( item.weight ) totalWeight += item.weight;
        }
    }

    if ( !totalWeight ) return;

    const probability = Math.random();

    for ( const item of items ) {
        if ( !item.weight ) continue;

        max += item.weight / totalWeight;

        if ( max >= probability ) return item;
    }
}

export function objectIsPlain ( object ) {
    return object instanceof Object && object.constructor === Object;
}

// XXX not efficient, need to remove
export function objectIsEmpty ( object ) {
    for ( const name in object ) return false;

    return true;
}

export function objectPick ( object, keys ) {
    return keys.reduce( ( result, key ) => {
        if ( key in object ) result[key] = object[key];

        return result;
    }, {} );
}

export function objectOmit ( object, keys ) {
    object = { ...object };

    keys.forEach( key => delete object[key] );

    return object;
}

export function mergeObjects ( [target, ...objects] ) {
    for ( const object of objects ) {
        if ( !object ) continue;

        for ( const property in object ) {
            if ( objectIsPlain( object[property] ) ) {
                if ( !objectIsPlain( target[property] ) ) target[property] = {};

                mergeObjects( [target[property], object[property]] );
            }
            else {
                target[property] = object[property];
            }
        }
    }

    return target;
}
