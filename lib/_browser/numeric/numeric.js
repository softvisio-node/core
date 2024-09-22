import DECIMAL from "decimal.js";

const DEFAULT_PRECISION = 32, // 1e9 - max., 1000 - max. for PostgresSQL
    NUMERIC_ACCESSOR = Symbol(),
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
    #numeric;
    #precision;
    #scale;
    #isNaN;
    #isFinite;
    #isInteger;
    #number;
    #integer;
    #decimal;
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
            this.#numeric = new Decimal( 0 );
        }
        else if ( value instanceof Numeric ) {
            this.#numeric = value[ NUMERIC_ACCESSOR ];
        }
        else if ( Decimal.isDecimal( value ) ) {
            this.#numeric = value;
        }
        else if ( typeof value === "bigint" ) {
            this.#numeric = Decimal( value.toString() );
        }
        else {
            this.#numeric = Decimal( value );
        }

        const decimalPlaces = this.#checkPrecision();

        // round to scale
        if ( decimalPlaces != null ) {
            this.#numeric = this.#numeric.toDecimalPlaces( decimalPlaces );

            // check precision afrer rounding
            if ( this.#checkPrecision() != null ) {
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
        this.#isNaN ??= this.#numeric.isNaN();

        return this.#isNaN;
    }

    get isPositiveInfinity () {
        return this.number === Infinity;
    }

    get isNegativeInfinity () {
        return this.number === -Infinity;
    }

    get isFinite () {
        this.#isFinite ??= this.#numeric.isFinite();

        return this.#isFinite;
    }

    get isInteger () {
        this.#isInteger ??= this.#numeric.isInteger();

        return this.#isInteger;
    }

    get isSafeInteger () {
        return Number.isSafeInteger( this.number );
    }

    get isZero () {
        return this.#numeric.isZero();
    }

    get isPositive () {
        return this.#numeric.isPositive();
    }

    get isNegative () {
        return this.#numeric.isNegative();
    }

    get realPrecision () {
        return this.#numeric.precision( true );
    }

    get realScale () {
        return this.#numeric.decimalPlaces();
    }

    get number () {
        this.#number ??= this.#numeric.toNumber();

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

    get decimal () {
        this.#decimal ??= this.subtract( this.integer );

        return this.#decimal;
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
        this.#negated ??= this.#clone( this.#numeric.negated() );

        return this.#negated;
    }

    get bin () {
        this.#binary ??= this.#numeric.toBinary();

        return this.#binary;
    }

    get hex () {
        this.#hexadecimal ??= this.#numeric.toHexadecimal();

        return this.#hexadecimal;
    }

    get oct () {
        this.#octal ??= this.#numeric.toOctal();

        return this.#octal;
    }

    // public
    toString () {
        this.#string ??= this.#numeric.toString();

        return this.#string;
    }

    toJSON () {
        return this.toString();
    }

    toFixed ( scale ) {
        return this.#numeric.toFixed( scale || 0 );
    }

    toPrecision ( precision ) {
        var scale;

        if ( typeof precision === "object" ) {
            ( { precision, scale } = precision );
        }

        return new this.constructor( this, {
            precision,
            scale,
        } );
    }

    toExponential ( scale ) {
        return this.#numeric.toExponential( scale );
    }

    add ( value ) {
        if ( this.constructor.isNumeric( value ) ) {
            value = value[ NUMERIC_ACCESSOR ];
        }

        return this.#clone( this.#numeric.add( value ) );
    }

    subtract ( value ) {
        if ( this.constructor.isNumeric( value ) ) {
            value = value[ NUMERIC_ACCESSOR ];
        }

        return this.#clone( this.#numeric.sub( value ) );
    }

    multiply ( value ) {
        if ( this.constructor.isNumeric( value ) ) {
            value = value[ NUMERIC_ACCESSOR ];
        }

        return this.#clone( this.#numeric.mul( value ) );
    }

    divide ( value ) {
        if ( this.constructor.isNumeric( value ) ) {
            value = value[ NUMERIC_ACCESSOR ];
        }

        return this.#clone( this.#numeric.div( value ) );
    }

    abs () {
        return this.#clone( this.#numeric.abs() );
    }

    mod ( value ) {
        if ( this.constructor.isNumeric( value ) ) {
            value = value[ NUMERIC_ACCESSOR ];
        }

        return this.#clone( this.#numeric.mod( value ) );
    }

    trunc ( scale ) {
        if ( scale ) {
            const multiplier = 10 ** scale;

            return this.#clone( this.#numeric.mul( multiplier ).trunc().div( multiplier ) );
        }
        else {
            return this.#clone( this.#numeric.trunc() );
        }
    }

    round ( scale ) {
        if ( scale ) {
            const multiplier = 10 ** scale;

            return this.#clone( this.#numeric.mul( multiplier ).round().div( multiplier ) );
        }
        else {
            return this.#clone( this.#numeric.round() );
        }
    }

    floor ( scale ) {
        if ( scale ) {
            const multiplier = 10 ** scale;

            return this.#clone( this.#numeric.mul( multiplier ).floor().div( multiplier ) );
        }
        else {
            return this.#clone( this.#numeric.floor() );
        }
    }

    ceil ( scale ) {
        if ( scale ) {
            const multiplier = 10 ** scale;

            return this.#clone( this.#numeric.mul( multiplier ).ceil().div( multiplier ) );
        }
        else {
            return this.#clone( this.#numeric.ceil() );
        }
    }

    compare ( value ) {
        if ( this.constructor.isNumeric( value ) ) {
            value = value[ NUMERIC_ACCESSOR ];
        }

        return this.#numeric.compare( value );
    }

    eq ( value ) {
        if ( this.constructor.isNumeric( value ) ) {
            value = value[ NUMERIC_ACCESSOR ];
        }

        return this.#numeric.equals( value );
    }

    gt ( value ) {
        if ( this.constructor.isNumeric( value ) ) {
            value = value[ NUMERIC_ACCESSOR ];
        }

        return this.#numeric.greaterThan( value );
    }

    gte ( value ) {
        if ( this.constructor.isNumeric( value ) ) {
            value = value[ NUMERIC_ACCESSOR ];
        }

        return this.#numeric.greaterThanOrEqualTo( value );
    }

    lt ( value ) {
        if ( this.constructor.isNumeric( value ) ) {
            value = value[ NUMERIC_ACCESSOR ];
        }

        return this.#numeric.lessThan( value );
    }

    lte ( value ) {
        if ( this.constructor.isNumeric( value ) ) {
            value = value[ NUMERIC_ACCESSOR ];
        }

        return this.#numeric.lessThanOrEqualTo( value );
    }

    // private
    get [ NUMERIC_ACCESSOR ] () {
        return this.#numeric;
    }

    #checkPrecision () {
        if ( !this.#precision && this.#scale == null ) return;

        var decimalPlaces;

        const realPrecision = this.#numeric.precision( true ),
            realScale = this.#numeric.decimalPlaces();

        // check precision
        if ( this.#precision ) {
            const realIntegerPlaces = realPrecision - realScale;

            // check integer places
            if ( this.#scale != null ) {
                const maxIntegerPlaces = this.#precision - this.#scale;

                if ( realIntegerPlaces > maxIntegerPlaces ) {
                    throw RangeError( `Numeric precision is out of range` );
                }
            }

            if ( this.#precision < realPrecision ) {
                decimalPlaces = this.#precision - realIntegerPlaces;

                if ( decimalPlaces < 0 ) {
                    throw RangeError( `Numeric precision is out of range` );
                }

                if ( this.#scale != null && this.#scale < decimalPlaces ) {
                    decimalPlaces = this.#scale;
                }
            }
        }

        // check scale
        else if ( this.#scale != null && this.#scale < realScale ) {
            decimalPlaces = this.#scale;
        }

        return decimalPlaces;
    }

    #clone ( value ) {
        return new this.constructor( value, {
            "precision": this.#precision,
            "scale": this.#scale,
        } );
    }
}
