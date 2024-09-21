import Numeric from "#lib/decimal";

export function trunc ( number, scale ) {
    if ( scale ) {
        const multiplier = 10 ** scale;

        return Numeric( number ).mul( multiplier ).trunc().div( multiplier ).toNumber();
    }
    else {
        return Math.trunc( number );
    }
}

export function floor ( number, scale ) {
    if ( scale ) {
        const multiplier = 10 ** scale;

        return Numeric( number ).mul( multiplier ).floor().div( multiplier ).toNumber();
    }
    else {
        return Math.floor( number );
    }
}

export function ceil ( number, scale ) {
    if ( scale ) {
        const multiplier = 10 ** scale;

        return Numeric( number ).mul( multiplier ).ceil().div( multiplier ).toNumber();
    }
    else {
        return Math.ceil( number );
    }
}

export function round ( number, scale ) {
    if ( scale ) {
        const multiplier = 10 ** scale;

        return Numeric( number ).mul( multiplier ).round().div( multiplier ).toNumber();
    }
    else {
        return Math.round( number );
    }
}
