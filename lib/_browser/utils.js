export async function sleep ( timeout ) {
    return new Promise( resolve => setTimeout( resolve, timeout ) );
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

export function getRandomWeight ( items, options = {} ) {
    var totalWeight = options.totalWeight ?? 0,
        max = 0;

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

const relativeTimeUnits = [
    ["year", 31536000000],
    ["month", 2628000000],
    ["day", 86400000],
    ["hour", 3600000],
    ["minute", 60000],
    ["second", 1000],
];

const relativeTimeFormat = new Intl.RelativeTimeFormat( "en", { "style": "narrow" } );

export function relativeTime ( milliseconds ) {
    for ( const [unit, threshold] of relativeTimeUnits ) {
        if ( Math.abs( milliseconds ) > threshold || unit === "second" ) {
            return relativeTimeFormat.format( Math.round( milliseconds / threshold ), unit );
        }
    }
}
