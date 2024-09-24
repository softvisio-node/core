import NumericClass from "#lib/_browser/numeric/numeric";
import { inspect } from "node:util";
import nodeCrypto from "node:crypto";

export default class Numeric extends NumericClass {
    constructor ( value, options ) {
        if ( Buffer.isBuffer( value ) ) {
            value = value.toString( "latin1" );
        }

        super( value, options );
    }

    // static
    // XXX
    random ( { scale, crypto, min, max } = {} ) {
        return nodeCrypto;
    }

    // public
    [ inspect.custom ] ( depth, options ) {
        return `[Numeric: ${ this.toString() }]`;
    }
}
