import NumericClass from "#lib/numeric/numeric";

export default function Numeric ( value, options ) {
    return NumericClass.new( value, options );
}

Object.setPrototypeOf( Numeric, NumericClass );
