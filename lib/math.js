import Numeric from "#lib/numeric";

export function trunc ( number, scale ) {
    if ( scale ) {
        return Numeric( number ).trunc( scale ).number;
    }
    else {
        return Math.trunc( number );
    }
}

export function round ( number, scale ) {
    if ( scale ) {
        return Numeric( number ).round( scale ).number;
    }
    else {
        return Math.round( number );
    }
}

export function floor ( number, scale ) {
    if ( scale ) {
        return Numeric( number ).floor( scale ).number;
    }
    else {
        return Math.floor( number );
    }
}

export function ceil ( number, scale ) {
    if ( scale ) {
        return Numeric( number ).ceil( scale ).number;
    }
    else {
        return Math.ceil( number );
    }
}
