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

export function getRandomWeight ( weights ) {
    var totalWeight = 0;

    for ( const weight of Object.values( weights ) ) if ( weight ) totalWeight += weight;

    var dist = [],
        start = 0;

    for ( const key in weights ) {
        if ( !weights[key] ) continue;

        const length = weights[key] / totalWeight;

        dist.push( [key, start, start + length] );

        start += length;
    }

    const random = Math.random();

    for ( const item of dist ) if ( random >= item[1] && random < item[2] ) return item[0];
}

export function objectIsPlain ( object ) {
    return object instanceof Object && object.constructor === Object;
}

// XXX not effective, need to remove
export function objectIsEmpty ( object ) {
    var name;

    for ( name in object ) {
        return false;
    }

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
