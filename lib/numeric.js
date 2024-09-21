import NumericClass from "#lib/numeric/numeric";

export default function Numeric ( value, options ) {
    return new NumericClass( value, options );
}

Object.setPrototypeOf( Numeric, NumericClass );
