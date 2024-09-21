import NumericClass from "#lib/_browser/numeric/numeric";
import { inspect } from "node:util";

export default class Numeric extends NumericClass {
    constructor ( value, options ) {
        if ( Buffer.isBuffer( value ) ) {
            value = value.toString( "latin1" );
        }

        super( value, options );
    }

    // public
    [ inspect.custom ] ( depth, options ) {
        return `[Numeric: ${ this.toString() }]`;
    }
}
