import NumericClass from "#lib/_browser/numeric/numeric";
import { inspect } from "node:util";

export default class Numeric extends NumericClass {

    // public
    [ inspect.custom ] ( depth, options ) {
        return `[Numeric: ${ this.valueOf() }]`;
    }
}
