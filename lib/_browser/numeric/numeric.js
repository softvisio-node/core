import DECIMAL from "decimal.js";

const DEFAULT_PRECISION = 32, // 1000 - max. for PostgresSQL, 1e9 - max.
    DECIMAL_ACCESSOR = Symbol(),
    ROUNDING_MODE = {
        "ROUND_UP": DECIMAL.ROUND_UP,
        "ROUND_DOWN": DECIMAL.ROUND_DOWN,
        "ROUND_CEIL": DECIMAL.ROUND_CEIL,
        "ROUND_FLOOR": DECIMAL.ROUND_FLOOR,
        "ROUND_HALF_UP": DECIMAL.ROUND_HALF_UP,
        "ROUND_HALF_DOWN": DECIMAL.ROUND_HALF_DOWN,
        "ROUND_HALF_EVEN": DECIMAL.ROUND_HALF_EVEN,
        "ROUND_HALF_CEIL": DECIMAL.ROUND_HALF_CEIL,
        "ROUND_HALF_FLOOR": DECIMAL.ROUND_HALF_FLOOR,
        "EUCLID": DECIMAL.EUCLID,
    },
    MODULO_MODE = {
        "ROUND_UP": ROUNDING_MODE.ROUND_UP,
        "ROUND_DOWN": ROUNDING_MODE.ROUND_DOWN,
        "ROUND_FLOOR": ROUNDING_MODE.ROUND_FLOOR,
        "ROUND_HALF_EVEN": ROUNDING_MODE.ROUND_HALF_EVEN,
        "EUCLID": ROUNDING_MODE.EUCLID,
    },
    Decimal = DECIMAL.clone( {
        "defaults": true,
        "precision": DEFAULT_PRECISION,
        "minE": -9e15,
        "maxE": 9e15,
        "toExpNeg": -9e15,
        "toExpPos": 9e15,
        "rounding": ROUNDING_MODE.ROUND_HALF_UP,
        "modulo": MODULO_MODE.ROUND_DOWN,
    } );

export default class Numeric {
    #decimal;
    #precision;
    #scale;
    #isNaN;
    #isFinite;
    #isInteger;
    #number;
    #integer;
    #fractional;
    #bigint;
    #negated;
    #string;
    #binary;
    #hexadecimal;
    #octal;

    constructor ( value, { precision, scale } = {} ) {

        // precision
        if ( precision ) {
            if ( precision > 0 ) {
                this.#precision = precision;
            }
            else {
                throw TypeError( `Precision must be number > 0` );
            }
        }
        else {
            this.#precision = null;
        }

        // scale
        if ( scale ) {
            if ( scale > 0 ) {
                this.#scale = scale;

                if ( this.#precision && this.#scale > this.#precision ) {
                    throw TypeError( `Scale must be <= precision` );
                }
            }
            else {
                throw TypeError( `Scale must be number >= 0` );
            }
        }
        else if ( scale === 0 ) {
            this.#scale = 0;
        }
        else {
            scale = null;
        }

        if ( value == null ) {
            this.#decimal = new Decimal( 0 );
        }
        else if ( value instanceof Numeric ) {
            this.#decimal = value[ DECIMAL_ACCESSOR ];
        }
        else if ( Decimal.isDecimal( value ) ) {
            this.#decimal = value;
        }
        else if ( typeof value === "bigint" ) {
            this.#decimal = Decimal( value.toString() );
        }
        else {
            this.#decimal = Decimal( value );
        }

        const realPrecision = this.#decimal.precision( true ),
            realScale = this.#decimal.decimalPlaces();

        var decimalPlaces;

        // check precision
        if ( this.#precision && this.#precision < realPrecision ) {
            decimalPlaces = this.#precision - ( realPrecision - realScale );

            if ( decimalPlaces < 0 ) {
                throw RangeError( `Numeric precision is out of range` );
            }

            if ( this.#scale != null && this.#scale < decimalPlaces ) {
                decimalPlaces = this.#scale;
            }
        }

        // check scale
        else if ( this.#scale != null && this.#scale < realScale ) {
            decimalPlaces = this.#scale;
        }

        // round to scale
        if ( decimalPlaces != null ) {
            this.#decimal = this.#decimal.toDecimalPlaces( decimalPlaces );

            // check precision afrer rounding
            if ( this.#precision && this.#decimal.precision( true ) > this.#precision ) {
                throw RangeError( `Numeric precision is out of range` );
            }
        }
    }

    // static
    static isNumeric ( value ) {
        return value instanceof Numeric;
    }

    static isNaN ( value ) {
        if ( this.isNumeric( value ) ) {
            return value.isNaN;
        }
        else {
            return Number.isNaN( value );
        }
    }

    static isFinite ( value ) {
        if ( this.isNumeric( value ) ) {
            return value.isFinite;
        }
        else {
            return Number.isFinite( value );
        }
    }

    static isInteger ( value ) {
        if ( this.isNumeric( value ) ) {
            return value.isInteger;
        }
        else {
            return Number.isInteger( value );
        }
    }

    static isSafeInteger ( value ) {
        if ( this.isNumeric( value ) ) {
            return value.isSafeInteger;
        }
        else {
            return Number.isSafeInteger( value );
        }
    }

    // properties
    get precision () {
        return this.#precision;
    }

    get scale () {
        return this.#scale;
    }

    get isNaN () {
        this.#isNaN ??= this.#decimal.isNaN();

        return this.#isNaN;
    }

    get isPositiveInfinity () {
        return this.number === Infinity;
    }

    get isNegativeInfinity () {
        return this.number === -Infinity;
    }

    get isFinite () {
        this.#isFinite ??= this.#decimal.isFinite();

        return this.#isFinite;
    }

    get isInteger () {
        this.#isInteger ??= this.#decimal.isInteger();

        return this.#isInteger;
    }

    get isSafeInteger () {
        return Number.isSafeInteger( this.number );
    }

    get isZero () {
        return this.#decimal.isZero();
    }

    get isPositive () {
        return this.#decimal.isPositive();
    }

    get isNegative () {
        return this.#decimal.isNegative();
    }

    get realPrecision () {
        return this.#decimal.precision( true );
    }

    get realScale () {
        return this.#decimal.decimalPlaces();
    }

    get number () {
        this.#number ??= this.#decimal.toNumber();

        return this.#number;
    }

    get integer () {
        if ( this.#integer == null ) {
            if ( this.isInteger ) {
                this.#integer = this;
            }
            else {
                this.#integer = this.trunc();
            }
        }

        return this.#integer;
    }

    get fractional () {
        if ( this.#fractional == null ) {
            this.#fractional = this.subtract( this.integer );
        }

        return this.#fractional;
    }

    get bigint () {
        if ( this.#bigint == null ) {

            // not a number
            if ( !this.isFinite ) {
                this.#bigint = this.number;
            }

            // integer
            else if ( this.isInteger ) {
                this.#bigint = BigInt( this.toString() );
            }

            // float
            else {
                this.#bigint = this.integer.bigint;
            }
        }

        return this.#bigint;
    }

    get negated () {
        this.#negated ??= this.#clone( this.#decimal.negated() );

        return this.#negated;
    }

    get bin () {
        this.#binary ??= this.#decimal.toBinary();

        return this.#binary;
    }

    get hex () {
        this.#hexadecimal ??= this.#decimal.toHexadecimal();

        return this.#hexadecimal;
    }

    get oct () {
        this.#octal ??= this.#decimal.toOctal();

        return this.#octal;
    }

    // public
    toString () {
        this.#string ??= this.#decimal.toString();

        return this.#string;
    }

    toJSON () {
        return this.toString();
    }

    toFixed ( scale ) {
        return this.#decimal.toFixed( scale || 0 );
    }

    // XXX inherit precision
    toPrecision ( precision ) {
        var scale;

        if ( typeof precision === "object" ) {
            scale = precision.scale;
            precision = precision.precision;
        }
        else {
            scale = this.scale;
        }

        return new this.constructor( this.#decimal, {
            precision,
            scale,
        } );
    }

    toExponential ( scale ) {
        return this.#decimal.toExponential( scale );
    }

    add ( value ) {
        if ( this.constructor.isNumeric( value ) ) {
            value = value[ DECIMAL_ACCESSOR ];
        }

        return this.#clone( this.#decimal.add( value ) );
    }

    subtract ( value ) {
        if ( this.constructor.isNumeric( value ) ) {
            value = value[ DECIMAL_ACCESSOR ];
        }

        return this.#clone( this.#decimal.sub( value ) );
    }

    multiply ( value ) {
        if ( this.constructor.isNumeric( value ) ) {
            value = value[ DECIMAL_ACCESSOR ];
        }

        return this.#clone( this.#decimal.mul( value ) );
    }

    divide ( value ) {
        if ( this.constructor.isNumeric( value ) ) {
            value = value[ DECIMAL_ACCESSOR ];
        }

        return this.#clone( this.#decimal.div( value ) );
    }

    abs () {
        return this.#clone( this.#decimal.abs() );
    }

    mod ( value ) {
        if ( this.constructor.isNumeric( value ) ) {
            value = value[ DECIMAL_ACCESSOR ];
        }

        return this.#clone( this.#decimal.mod( value ) );
    }

    trunc ( scale ) {
        if ( scale ) {
            const multiplier = 10 ** scale;

            return this.#clone( this.#decimal.mul( multiplier ).trunc().div( multiplier ) );
        }
        else {
            return this.#clone( this.#decimal.trunc() );
        }
    }

    round ( scale ) {
        if ( scale ) {
            const multiplier = 10 ** scale;

            return this.#clone( this.#decimal.mul( multiplier ).round().div( multiplier ) );
        }
        else {
            return this.#clone( this.#decimal.round() );
        }
    }

    floor ( scale ) {
        if ( scale ) {
            const multiplier = 10 ** scale;

            return this.#clone( this.#decimal.mul( multiplier ).floor().div( multiplier ) );
        }
        else {
            return this.#clone( this.#decimal.floor() );
        }
    }

    ceil ( scale ) {
        if ( scale ) {
            const multiplier = 10 ** scale;

            return this.#clone( this.#decimal.mul( multiplier ).ceil().div( multiplier ) );
        }
        else {
            return this.#clone( this.#decimal.ceil() );
        }
    }

    compare ( value ) {
        if ( this.constructor.isNumeric( value ) ) {
            value = value[ DECIMAL_ACCESSOR ];
        }

        return this.#decimal.compare( value );
    }

    eq ( value ) {
        if ( this.constructor.isNumeric( value ) ) {
            value = value[ DECIMAL_ACCESSOR ];
        }

        return this.#decimal.equals( value );
    }

    gt ( value ) {
        if ( this.constructor.isNumeric( value ) ) {
            value = value[ DECIMAL_ACCESSOR ];
        }

        return this.#decimal.greaterThan( value );
    }

    gte ( value ) {
        if ( this.constructor.isNumeric( value ) ) {
            value = value[ DECIMAL_ACCESSOR ];
        }

        return this.#decimal.greaterThanOrEqualTo( value );
    }

    lt ( value ) {
        if ( this.constructor.isNumeric( value ) ) {
            value = value[ DECIMAL_ACCESSOR ];
        }

        return this.#decimal.lessThan( value );
    }

    lte ( value ) {
        if ( this.constructor.isNumeric( value ) ) {
            value = value[ DECIMAL_ACCESSOR ];
        }

        return this.#decimal.lessThanOrEqualTo( value );
    }

    // private
    get [ DECIMAL_ACCESSOR ] () {
        return this.#decimal;
    }

    #clone ( value ) {
        return new this.constructor( value, {
            "precision": this.#precision,
            "scale": this.#scale,
        } );
    }
}
