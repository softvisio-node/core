import Numeric from "#lib/decimal";

export function trunc ( number, scale ) {
    if ( scale ) {
        const multiplier = 10 ** scale;

        return Numeric( number ).mul( multiplier ).trunc().div( multiplier );
    }
    else {
        return Math.trunc( number );
    }
}
