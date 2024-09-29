import DECIMAL from "decimal.js";
import CacheLru from "#lib/cache/lru";

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
    DECIMALS = new CacheLru( { "maxSize": 1000 } );

function getDecimal ( precision ) {
    precision ||= DEFAULT_PRECISION;

    var decimal = DECIMALS.get( precision );

    if ( !decimal ) {
        decimal = DECIMAL.clone( {
            "defaults": true,
            precision,
            "minE": -9e15,
            "maxE": 9e15,
            "toExpNeg": -9e15,
            "toExpPos": 9e15,
            "rounding": ROUNDING_MODE.ROUND_HALF_UP,
            "modulo": MODULO_MODE.ROUND_DOWN,
            "crypto": false,
        } );

        DECIMALS.set( precision, decimal );
    }

    return decimal;
}

function isNumeric ( value ) {
    return value instanceof Numeric;
}

function prepareDecimalValue ( value ) {
    if ( isNumeric( value ) ) {
        return value[ NUMERIC_ACCESSOR ];
    }
    else if ( typeof value === "bigint" ) {
        return value.toString();
    }
    else {
        return value;
    }
}

export default class Numeric {
    #SCALE;
    #MAX_INTEGER;
    #numeric;
    #isNaN;
    #isFinite;
    #isInteger;
    #number;
    #integer;
    #decimal;
    #bigint;
    #negated;
    #string;
    #value;
    #bin;
    #hex;
    #oct;
    #abs;
    #sqrt;
    #cbrt;
    #exp;

    constructor ( value, { precision, scale } = {} ) {
        this.#SCALE = scale ?? null;

        if ( value == null ) {
            this.#numeric = getDecimal( precision )( 0 );
        }
        else if ( value instanceof Numeric ) {
            this.#numeric = value[ NUMERIC_ACCESSOR ];
        }
        else if ( DECIMAL.isDecimal( value ) ) {
            this.#numeric = value;
        }
        else if ( typeof value === "bigint" ) {
            this.#numeric = getDecimal( precision )( value.toString() );
        }
        else {
            this.#numeric = getDecimal( precision )( value );
        }

        // check precision
        this.#numeric = this.#toPrecision( this.#numeric, precision, this.#SCALE );
    }

    // static
    static get MAX_PRECISION () {
        return 1e9;
    }

    static get DEFAULT_PRECISION () {
        return DEFAULT_PRECISION;
    }

    static isNumeric ( value ) {
        return isNumeric( value );
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

    static max ( ...args ) {
        var res = null;

        for ( let arg of args ) {
            if ( arg == null ) {
                continue;
            }

            if ( !isNumeric( arg ) ) {
                arg = new this( arg );
            }

            if ( arg.isNaN ) {
                continue;
            }
            else if ( res == null ) {
                res = arg;
            }
            else if ( arg[ NUMERIC_ACCESSOR ].greaterThan( res[ NUMERIC_ACCESSOR ] ) ) {
                res = arg;
            }
        }

        return res;
    }

    static min ( ...args ) {
        var res = null;

        for ( let arg of args ) {
            if ( arg == null ) {
                continue;
            }

            if ( !isNumeric( arg ) ) {
                arg = new this( arg );
            }

            if ( arg.isNaN ) {
                continue;
            }
            else if ( res == null ) {
                res = arg;
            }
            else if ( arg[ NUMERIC_ACCESSOR ].lessThan( res[ NUMERIC_ACCESSOR ] ) ) {
                res = arg;
            }
        }

        return res;
    }

    static random ( { "crypto": useCrypto, precision, scale } = {} ) {
        const Decimal = getDecimal( precision );

        if ( useCrypto && crypto.getRandomValues ) {
            Decimal.crypto = true;
        }
        else {
            Decimal.crypto = false;
        }

        const random = Decimal.random( scale || undefined );

        return new this( random );
    }

    static randomInteger ( { min, max, "crypto": useCrypto, precision } = {} ) {
        min = BigInt( min ?? 0 );
        max = BigInt( max ?? 0 );

        // swap min / max
        if ( min > max ) {
            const _max = max;
            max = min;
            min = _max;
        }

        precision = Math.max(

            //
            precision || 0,
            this.DEFAULT_PRECISION,
            min.toString().replace( "-", "" ).length,
            max.toString().replace( "-", "" ).length
        );

        const Decimal = getDecimal( precision );

        if ( useCrypto && crypto.getRandomValues ) {
            Decimal.crypto = true;
        }
        else {
            Decimal.crypto = false;
        }

        if ( min === max ) {
            return new this( min, {
                precision,
            } );
        }
        else {
            const range = max - min,
                random = Decimal.random( range.toString().length + 1 )
                    .mul( ( range + 1n ).toString() )
                    .trunc()
                    .add( min.toString() );

            return new this( random, {
                precision,
            } );
        }
    }

    static getRandomWeight ( items, { totalWeight } = {} ) {
        var max = 0;

        totalWeight ||= 0;

        // calculate total weight
        if ( !totalWeight ) {
            for ( const item of items ) {
                if ( item.weight ) totalWeight += item.weight;
            }
        }

        if ( !totalWeight ) return;

        const probability = Math.random();

        for ( const item of items ) {
            if ( !item.weight ) continue;

            max += item.weight / totalWeight;

            if ( max >= probability ) return item;
        }
    }

    // properties
    get PRECISION () {
        return this.#numeric.constructor.precision;
    }

    get SCALE () {
        return this.#SCALE;
    }

    get MAX_INTEGER () {
        if ( this.#MAX_INTEGER == null ) {
            let value = this.PRECISION - ( this.SCALE || 0 );

            if ( value ) {
                value = "9".repeat( value );
            }

            this.#MAX_INTEGER = new this.constructor( value );
        }

        return this.#MAX_INTEGER;
    }

    get MIN_INTEGER () {
        return this.MAX_INTEGER.negated;
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

    get precision () {
        return this.#numeric.precision( true );
    }

    get scale () {
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
        this.#bin ??= this.#numeric.toBinary();

        return this.#bin;
    }

    get hex () {
        this.#hex ??= this.#numeric.toHexadecimal();

        return this.#hex;
    }

    get oct () {
        this.#oct ??= this.#numeric.toOctal();

        return this.#oct;
    }

    get abs () {
        this.#abs ??= this.#clone( this.#numeric.abs() );

        return this.#abs;
    }

    get sqrt () {
        this.#sqrt ??= this.#clone( this.#numeric.sqrt() );

        return this.#sqrt;
    }

    get cbrt () {
        this.#cbrt ??= this.#clone( this.#numeric.cbrt() );

        return this.#cbrt;
    }

    get exp () {
        this.#exp ??= this.#clone( this.#numeric.exp() );

        return this.#exp;
    }

    get sign () {
        return this.#numeric.sign();
    }

    // public
    toString () {
        this.#string ??= this.#numeric.toString();

        return this.#string;
    }

    valueOf () {
        this.#value ??= this.#numeric.valueOf();

        return this.#value;
    }

    toJSON () {
        return this.toString();
    }

    toPrecision ( precision ) {
        var scale;

        if ( typeof precision === "object" ) {
            ( { precision, scale } = precision );
        }

        return new this.constructor( this.#toPrecision( this.#numeric, precision, scale ) );
    }

    toExponential ( scale ) {
        return this.#numeric.toExponential( scale );
    }

    add ( value ) {
        value = prepareDecimalValue( value );

        return this.#clone( this.#numeric.add( value ) );
    }

    subtract ( value ) {
        value = prepareDecimalValue( value );

        return this.#clone( this.#numeric.sub( value ) );
    }

    multiply ( value ) {
        value = prepareDecimalValue( value );

        return this.#clone( this.#numeric.mul( value ) );
    }

    divide ( value ) {
        value = prepareDecimalValue( value );

        return this.#clone( this.#numeric.div( value ) );
    }

    mod ( value ) {
        value = prepareDecimalValue( value );

        return this.#clone( this.#numeric.mod( value ) );
    }

    pow ( exponent ) {
        if ( isNumeric( exponent ) ) {
            exponent = exponent[ NUMERIC_ACCESSOR ];
        }

        return this.#clone( this.#numeric.pow( exponent ) );
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
        value = prepareDecimalValue( value );

        return this.#numeric.compare( value );
    }

    eq ( value ) {
        value = prepareDecimalValue( value );

        return this.#numeric.equals( value );
    }

    gt ( value ) {
        value = prepareDecimalValue( value );

        return this.#numeric.greaterThan( value );
    }

    gte ( value ) {
        value = prepareDecimalValue( value );

        return this.#numeric.greaterThanOrEqualTo( value );
    }

    lt ( value ) {
        value = prepareDecimalValue( value );

        return this.#numeric.lessThan( value );
    }

    lte ( value ) {
        value = prepareDecimalValue( value );

        return this.#numeric.lessThanOrEqualTo( value );
    }

    // private
    get [ NUMERIC_ACCESSOR ] () {
        return this.#numeric;
    }

    #clone ( value ) {
        return new this.constructor( value, {
            "scale": this.#SCALE,
        } );
    }

    #toPrecision ( decimal, precision, scale ) {

        // check precision
        if ( precision == null ) {
            precision = decimal.constructor.precision;
        }
        else {
            if ( !Number.isInteger( precision ) || precision <= 0 ) {
                throw TypeError( `Precision must be number > 0` );
            }

            // update decimal precision
            if ( precision !== decimal.constructor.precision ) {
                decimal = getDecimal( precision )( decimal );
            }
        }

        var maxIntegerPlaces;

        // check scale
        if ( scale == null ) {
            maxIntegerPlaces = precision;
        }
        else if ( scale === 0 ) {
            maxIntegerPlaces = precision;
        }
        else if ( Number.isInteger( scale ) && scale > 0 ) {
            if ( scale > precision ) {
                throw TypeError( `Scale must be integer <= precision` );
            }

            maxIntegerPlaces = precision - scale;
        }
        else {
            throw TypeError( `Scale must be positive integer` );
        }

        const realPrecision = decimal.precision( true ),
            realScale = decimal.decimalPlaces(),
            realIntegerPlaces = realPrecision - realScale;

        // check integer places
        if ( realIntegerPlaces > maxIntegerPlaces ) {
            throw RangeError( `Numeric precision is out of range` );
        }

        var decimalPlaces;

        // check precision
        if ( realPrecision > precision ) {
            decimalPlaces = precision - realIntegerPlaces;

            if ( decimalPlaces < 0 ) {
                throw RangeError( `Numeric precision is out of range` );
            }
            else if ( scale != null && scale < decimalPlaces ) {
                decimalPlaces = scale;
            }
        }

        // check scale
        else if ( scale != null && scale < realScale ) {
            decimalPlaces = scale;
        }

        // round to decimal places
        if ( decimalPlaces != null ) {
            decimal = decimal.toDecimalPlaces( decimalPlaces );

            // check integer places
            if ( decimal.precision( true ) - decimal.decimalPlaces() > maxIntegerPlaces ) {
                throw RangeError( `Numeric precision is out of range` );
            }
        }

        return decimal;
    }
}