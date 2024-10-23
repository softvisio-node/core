import DECIMAL from "decimal.js";
import CacheLru from "#lib/cache/lru";

const DEFAULT_PRECISION = 32,
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
    ROUNDING_MODE_VALUES = new Set( Object.values( ROUNDING_MODE ) ),
    MODULO_MODE = {
        "ROUND_UP": ROUNDING_MODE.ROUND_UP,
        "ROUND_DOWN": ROUNDING_MODE.ROUND_DOWN,
        "ROUND_FLOOR": ROUNDING_MODE.ROUND_FLOOR,
        "ROUND_HALF_EVEN": ROUNDING_MODE.ROUND_HALF_EVEN,
        "EUCLID": ROUNDING_MODE.EUCLID,
    },
    MODULO_MODE_VALUES = new Set( Object.values( MODULO_MODE ) ),
    DEFAULT_ROUNDING_MODE = ROUNDING_MODE.ROUND_HALF_UP,
    DEFAULT_MODULO_MODE = MODULO_MODE.ROUND_DOWN,
    NUMERICS = {};

var DECIMALS;

function getDecimal ( precision, rounding, modulo ) {
    DECIMALS ??= new CacheLru( { "maxSize": 1000 } );

    precision ||= DEFAULT_PRECISION;
    rounding ??= DEFAULT_ROUNDING_MODE;
    modulo ??= DEFAULT_MODULO_MODE;

    const id = precision + "/" + rounding + "/" + modulo;

    var decimal = DECIMALS.get( id );

    if ( !decimal ) {
        decimal = DECIMAL.clone( {
            "defaults": true,
            precision,
            "minE": -9e15,
            "maxE": 9e15,
            "toExpNeg": -9e15,
            "toExpPos": 9e15,
            rounding,
            modulo,
            "crypto": false,
        } );

        DECIMALS.set( id, decimal );
    }

    return decimal;
}

function isNumeric ( value ) {
    return value instanceof Numeric;
}

function prepareDecimalValue ( value ) {
    if ( isNumeric( value ) ) {
        return value[ DECIMAL_ACCESSOR ];
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
    #DECIMAL;
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
    #value;
    #bin;
    #hex;
    #oct;
    #abs;
    #sqrt;
    #cbrt;
    #exp;

    constructor ( value, { precision, scale, rounding, modulo } = {} ) {
        this.#SCALE = scale ?? null;

        if ( value == null ) {
            this.#DECIMAL = getDecimal( precision, rounding, modulo )( 0 );
        }
        else if ( value instanceof Numeric ) {
            this.#DECIMAL = value[ DECIMAL_ACCESSOR ];
        }
        else if ( DECIMAL.isDecimal( value ) ) {
            this.#DECIMAL = value;
        }
        else if ( typeof value === "bigint" ) {
            this.#DECIMAL = getDecimal( precision, rounding, modulo )( value.toString() );
        }
        else {
            this.#DECIMAL = getDecimal( precision, rounding, modulo )( value );
        }

        // check precision
        this.#DECIMAL = this.#toPrecision( this.#DECIMAL, precision, this.#SCALE, rounding, modulo );
    }

    // static
    static get ROUND_UP () {
        return ROUNDING_MODE.ROUND_UP;
    }

    static get ROUND_DOWN () {
        return ROUNDING_MODE.ROUND_DOWN;
    }

    static get ROUND_CEIL () {
        return ROUNDING_MODE.ROUND_CEIL;
    }

    static get ROUND_FLOOR () {
        return ROUNDING_MODE.ROUND_FLOOR;
    }

    static get ROUND_HALF_UP () {
        return ROUNDING_MODE.ROUND_HALF_UP;
    }

    static get ROUND_HALF_DOWN () {
        return ROUNDING_MODE.ROUND_HALF_DOWN;
    }

    static get ROUND_HALF_EVEN () {
        return ROUNDING_MODE.ROUND_HALF_EVEN;
    }

    static get ROUND_HALF_CEIL () {
        return ROUNDING_MODE.ROUND_HALF_CEIL;
    }

    static get ROUND_HALF_FLOOR () {
        return ROUNDING_MODE.ROUND_HALF_FLOOR;
    }

    static get EUCLID () {
        return ROUNDING_MODE.EUCLID;
    }

    static get MAX_PRECISION () {
        return 1e9;
    }

    static get DEFAULT_PRECISION () {
        return DEFAULT_PRECISION;
    }

    static get INT8_PRECISION () {
        return 3;
    }

    static get INT16_PRECISION () {
        return 5;
    }

    static get INT32_PRECISION () {
        return 10;
    }

    static get INT53_PRECISION () {
        return 16;
    }

    static get INT64_PRECISION () {
        return 20;
    }

    static get INT128_PRECISION () {
        return 40;
    }

    static get MIN_SIGNED_INT8 () {
        return ( NUMERICS.MIN_SIGNED_INT8 ??= this.MAX_UNSIGNED_INT8.add( 1 ).divide( 2 ).negated );
    }

    static get MAX_SIGNED_INT8 () {
        return ( NUMERICS.MAX_SIGNED_INT8 ??= this.MAX_UNSIGNED_INT8.subtract( 1 ).divide( 2 ) );
    }

    static get MAX_UNSIGNED_INT8 () {
        return ( NUMERICS.MAX_UNSIGNED_INT8 ??= new this( 0xFF, {
            "precision": this.INT8_PRECISION,
        } ) );
    }

    static get MIN_SIGNED_INT16 () {
        return ( NUMERICS.MIN_SIGNED_INT16 ??= this.MAX_UNSIGNED_INT16.add( 1 ).divide( 2 ).negated );
    }

    static get MAX_SIGNED_INT16 () {
        return ( NUMERICS.MAX_SIGNED_INT16 ??= this.MAX_UNSIGNED_INT16.subtract( 1 ).divide( 2 ) );
    }

    static get MAX_UNSIGNED_INT16 () {
        return ( NUMERICS.MAX_UNSIGNED_INT16 ??= new this( 0xFF_FF, {
            "precision": this.INT16_PRECISION,
        } ) );
    }

    static get MIN_SIGNED_INT32 () {
        return ( NUMERICS.MIN_SIGNED_INT32 ??= this.MAX_UNSIGNED_INT32.add( 1 ).divide( 2 ).negated );
    }

    static get MAX_SIGNED_INT32 () {
        return ( NUMERICS.MAX_SIGNED_INT32 ??= this.MAX_UNSIGNED_INT32.subtract( 1 ).divide( 2 ) );
    }

    static get MAX_UNSIGNED_INT32 () {
        return ( NUMERICS.MAX_UNSIGNED_INT32 ??= new this( 0xFF_FF_FF_FF, {
            "precision": this.INT32_PRECISION,
        } ) );
    }

    static get MIN_SIGNED_INT53 () {
        return this.MAX_UNSIGNED_INT53.negated;
    }

    static get MAX_SIGNED_INT53 () {
        return this.MAX_UNSIGNED_INT53;
    }

    static get MAX_UNSIGNED_INT53 () {
        return ( NUMERICS.MAX_UNSIGNED_INT53 ??= new this( Number.MAX_SAFE_INTEGER, {
            "precision": this.INT53_PRECISION,
        } ) );
    }

    static get MIN_SIGNED_INT64 () {
        return ( NUMERICS.MIN_SIGNED_INT64 ??= this.MAX_UNSIGNED_INT64.add( 1 ).divide( 2 ).negated );
    }

    static get MAX_SIGNED_INT64 () {
        return ( NUMERICS.MAX_SIGNED_INT64 ??= this.MAX_UNSIGNED_INT64.subtract( 1 ).divide( 2 ) );
    }

    static get MAX_UNSIGNED_INT64 () {
        return ( NUMERICS.MAX_UNSIGNED_INT64 ??= new this( "0xFFFFFFFFFFFFFFFF", {
            "precision": this.INT64_PRECISION,
        } ) );
    }

    static get MIN_SIGNED_INT128 () {
        return ( NUMERICS.MIN_SIGNED_INT128 ??= this.MAX_UNSIGNED_INT128.add( 1 ).divide( 2 ).negated );
    }

    static get MAX_SIGNED_INT128 () {
        return ( NUMERICS.MAX_SIGNED_INT128 ??= this.MAX_UNSIGNED_INT128.subtract( 1 ).divide( 2 ) );
    }

    static get MAX_UNSIGNED_INT128 () {
        return ( NUMERICS.MAX_UNSIGNED_INT128 ??= new this( "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF", {
            "precision": this.INT128_PRECISION,
        } ) );
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
            else if ( arg[ DECIMAL_ACCESSOR ].greaterThan( res[ DECIMAL_ACCESSOR ] ) ) {
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
            else if ( arg[ DECIMAL_ACCESSOR ].lessThan( res[ DECIMAL_ACCESSOR ] ) ) {
                res = arg;
            }
        }

        return res;
    }

    static getRandomDecimal ( { "crypto": useCrypto, precision, scale } = {} ) {
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

    static getRandomInt ( { signed, min, max, "crypto": useCrypto, precision } = {} ) {
        if ( min == null ) {
            if ( signed ) {
                min = -1n;
            }
            else {
                min = 0n;
            }
        }
        else if ( typeof min !== "bigint" ) {
            min = BigInt( min );
        }

        if ( max == null ) {
            if ( signed ) {
                max = 1n;
            }
            else {
                max = 1n;
            }
        }
        else if ( typeof max !== "bigint" ) {
            max = BigInt( max );
        }

        // swap min / max
        if ( min > max ) {
            const _max = max;
            max = min;
            min = _max;
        }

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

    static getRandomInt8 ( { signed, min, max, crypto, precision } = {} ) {
        if ( min == null ) {
            if ( signed ) {
                min = this.MIN_SIGNED_INT8.bigint;
            }
            else {
                min = 0n;
            }
        }

        if ( max == null ) {
            if ( signed ) {
                max = this.MAX_SIGNED_INT8.bigint;
            }
            else {
                max = this.MAX_UNSIGNED_INT8.bigint;
            }
        }

        return this.getRandomInt( {
            min,
            max,
            crypto,
            "precision": precision || this.INT8_PRECISION,
        } );
    }

    static getRandomInt16 ( { signed, min, max, crypto, precision } = {} ) {
        if ( min == null ) {
            if ( signed ) {
                min = this.MIN_SIGNED_INT16.bigint;
            }
            else {
                min = 0n;
            }
        }

        if ( max == null ) {
            if ( signed ) {
                max = this.MAX_SIGNED_INT16.bigint;
            }
            else {
                max = this.MAX_UNSIGNED_INT16.bigint;
            }
        }

        return this.getRandomInt( {
            min,
            max,
            crypto,
            "precision": precision || this.INT16_PRECISION,
        } );
    }

    static getRandomInt32 ( { signed, min, max, crypto, precision } = {} ) {
        if ( min == null ) {
            if ( signed ) {
                min = this.MIN_SIGNED_INT32.bigint;
            }
            else {
                min = 0n;
            }
        }

        if ( max == null ) {
            if ( signed ) {
                max = this.MAX_SIGNED_INT32.bigint;
            }
            else {
                max = this.MAX_UNSIGNED_INT32.bigint;
            }
        }

        return this.getRandomInt( {
            min,
            max,
            crypto,
            "precision": precision || this.INT32_PRECISION,
        } );
    }

    static getRandomInt53 ( { signed, min, max, crypto, precision } = {} ) {
        if ( min == null ) {
            if ( signed ) {
                min = this.MIN_SIGNED_INT53.bigint;
            }
            else {
                min = 0n;
            }
        }

        if ( max == null ) {
            if ( signed ) {
                max = this.MAX_SIGNED_INT53.bigint;
            }
            else {
                max = this.MAX_UNSIGNED_INT53.bigint;
            }
        }

        return this.getRandomInt( {
            min,
            max,
            crypto,
            "precision": precision || this.INT53_PRECISION,
        } );
    }

    static getRandomInt64 ( { signed, min, max, crypto, precision } = {} ) {
        if ( min == null ) {
            if ( signed ) {
                min = this.MIN_SIGNED_INT64.bigint;
            }
            else {
                min = 0n;
            }
        }

        if ( max == null ) {
            if ( signed ) {
                max = this.MAX_SIGNED_INT64.bigint;
            }
            else {
                max = this.MAX_UNSIGNED_INT64.bigint;
            }
        }

        return this.getRandomInt( {
            min,
            max,
            crypto,
            "precision": precision || this.INT64_PRECISION,
        } );
    }

    static getRandomInt128 ( { signed, min, max, crypto, precision } = {} ) {
        if ( min == null ) {
            if ( signed ) {
                min = this.MIN_SIGNED_INT128.bigint;
            }
            else {
                min = 0n;
            }
        }

        if ( max == null ) {
            if ( signed ) {
                max = this.MAX_SIGNED_INT128.bigint;
            }
            else {
                max = this.MAX_UNSIGNED_INT128.bigint;
            }
        }

        return this.getRandomInt( {
            min,
            max,
            crypto,
            "precision": precision || this.INT128_PRECISION,
        } );
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
        return this.#DECIMAL.constructor.precision;
    }

    get SCALE () {
        return this.#SCALE;
    }

    get ROUNDING () {
        return this.#DECIMAL.constructor.rounding;
    }

    get MODULO () {
        return this.#DECIMAL.constructor.modulo;
    }

    get MIN_INTEGER () {
        return this.MAX_INTEGER.negated;
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

    get precision () {
        return ( this.#precision ??= this.#DECIMAL.precision( true ) );
    }

    get scale () {
        return ( this.#scale ??= this.#DECIMAL.decimalPlaces() );
    }

    get isNaN () {
        this.#isNaN ??= this.#DECIMAL.isNaN();

        return this.#isNaN;
    }

    get isPositiveInfinity () {
        return this.number === Infinity;
    }

    get isNegativeInfinity () {
        return this.number === -Infinity;
    }

    get isFinite () {
        this.#isFinite ??= this.#DECIMAL.isFinite();

        return this.#isFinite;
    }

    get isInteger () {
        this.#isInteger ??= this.#DECIMAL.isInteger();

        return this.#isInteger;
    }

    get isSafeInteger () {
        return Number.isSafeInteger( this.number );
    }

    get isZero () {
        return this.#DECIMAL.isZero();
    }

    get isPositive () {
        return this.#DECIMAL.isPositive();
    }

    get isNegative () {
        return this.#DECIMAL.isNegative();
    }

    get number () {
        this.#number ??= this.#DECIMAL.toNumber();

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
        this.#negated ??= this.#clone( this.#DECIMAL.negated() );

        return this.#negated;
    }

    get bin () {
        this.#bin ??= this.#DECIMAL.toBinary();

        return this.#bin;
    }

    get hex () {
        this.#hex ??= this.#DECIMAL.toHexadecimal();

        return this.#hex;
    }

    get oct () {
        this.#oct ??= this.#DECIMAL.toOctal();

        return this.#oct;
    }

    get abs () {
        this.#abs ??= this.#clone( this.#DECIMAL.abs() );

        return this.#abs;
    }

    get sqrt () {
        this.#sqrt ??= this.#clone( this.#DECIMAL.sqrt() );

        return this.#sqrt;
    }

    get cbrt () {
        this.#cbrt ??= this.#clone( this.#DECIMAL.cbrt() );

        return this.#cbrt;
    }

    get exp () {
        this.#exp ??= this.#clone( this.#DECIMAL.exp() );

        return this.#exp;
    }

    get sign () {
        return this.#DECIMAL.sign();
    }

    // public
    toString () {
        this.#string ??= this.#DECIMAL.toString();

        return this.#string;
    }

    valueOf () {
        this.#value ??= this.#DECIMAL.valueOf();

        return this.#value;
    }

    toJSON () {
        return this.valueOf();
    }

    // XXX default values
    toPrecision ( { precision, scale = this.SCALE, rounding, modulo } = {} ) {
        return new this.constructor( this.#DECIMAL, {
            precision,
            scale,
            rounding,
            modulo,
        } );
    }

    toExponential ( scale ) {
        return this.#DECIMAL.toExponential( scale );
    }

    add ( value ) {
        value = prepareDecimalValue( value );

        return this.#clone( this.#DECIMAL.add( value ) );
    }

    subtract ( value ) {
        value = prepareDecimalValue( value );

        return this.#clone( this.#DECIMAL.sub( value ) );
    }

    multiply ( value ) {
        value = prepareDecimalValue( value );

        return this.#clone( this.#DECIMAL.mul( value ) );
    }

    divide ( value ) {
        value = prepareDecimalValue( value );

        return this.#clone( this.#DECIMAL.div( value ) );
    }

    // XXX
    mod ( value, { moduloMode } = {} ) {
        value = prepareDecimalValue( value );

        return this.#clone( this.#DECIMAL.mod( value ) );
    }

    pow ( exponent ) {
        if ( isNumeric( exponent ) ) {
            exponent = exponent[ DECIMAL_ACCESSOR ];
        }

        return this.#clone( this.#DECIMAL.pow( exponent ) );
    }

    // XXX
    round ( scale, roundingMode ) {
        if ( scale || roundingMode != null ) {
            return this.#clone( this.#DECIMAL.toDecimalPlaces( scale ?? 0, roundingMode ) );
        }
        else {
            return this.#clone( this.#DECIMAL.round() );
        }
    }

    trunc ( scale ) {
        if ( scale ) {
            return this.#clone( this.#DECIMAL.toDecimalPlaces( scale, ROUNDING_MODE.ROUND_DOWN ) );
        }
        else {
            return this.#clone( this.#DECIMAL.trunc() );
        }
    }

    floor ( scale ) {
        if ( scale ) {
            return this.#clone( this.#DECIMAL.toDecimalPlaces( scale, ROUNDING_MODE.ROUND_FLOOR ) );
        }
        else {
            return this.#clone( this.#DECIMAL.floor() );
        }
    }

    ceil ( scale ) {
        if ( scale ) {
            return this.#clone( this.#DECIMAL.toDecimalPlaces( scale, ROUNDING_MODE.ROUND_CEIL ) );
        }
        else {
            return this.#clone( this.#DECIMAL.ceil() );
        }
    }

    compare ( value ) {
        value = prepareDecimalValue( value );

        return this.#DECIMAL.compare( value );
    }

    eq ( value ) {
        value = prepareDecimalValue( value );

        return this.#DECIMAL.equals( value );
    }

    gt ( value ) {
        value = prepareDecimalValue( value );

        return this.#DECIMAL.greaterThan( value );
    }

    gte ( value ) {
        value = prepareDecimalValue( value );

        return this.#DECIMAL.greaterThanOrEqualTo( value );
    }

    lt ( value ) {
        value = prepareDecimalValue( value );

        return this.#DECIMAL.lessThan( value );
    }

    lte ( value ) {
        value = prepareDecimalValue( value );

        return this.#DECIMAL.lessThanOrEqualTo( value );
    }

    // private
    get [ DECIMAL_ACCESSOR ] () {
        return this.#DECIMAL;
    }

    #clone ( value ) {
        return new this.constructor( value, {
            "scale": this.#SCALE,
        } );
    }

    #toPrecision ( decimal, precision, scale, rounding, modulo ) {

        // check precision
        if ( precision == null ) {
            precision = decimal.constructor.precision;
        }
        else if ( !Number.isInteger( precision ) || precision <= 0 ) {
            throw TypeError( `Precision must be number > 0` );
        }

        // check rounding
        if ( rounding == null ) {
            rounding = decimal.constructor.rounding;
        }
        else if ( !ROUNDING_MODE_VALUES.has( rounding ) ) {
            throw TypeError( `Rounding value is not valid` );
        }

        // check modulo
        if ( modulo == null ) {
            modulo = decimal.constructor.modulo;
        }
        else if ( !MODULO_MODE_VALUES.has( modulo ) ) {
            throw TypeError( `Modulo value is not valid` );
        }

        // update decimal
        if ( precision !== decimal.constructor.precision || rounding !== decimal.constructor.rounding || modulo !== decimal.constructor.modulo ) {
            decimal = getDecimal( precision, rounding, modulo )( decimal );
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
