import Decimal from "decimal.js";

const CustomDecimal = Decimal.clone( {
        "defaults": true,
        "precision": 1e9,
        "minE": -9e15,
        "maxE": 9e15,
        "rounding": 4,
        "toExpNeg": -9e15,
        "toExpPos": 9e15,
        "modulo": 1,
    } ),
    decimalProperty = Symbol();

export default class Numeric {
    #decimal;
    #precision;
    #scale;
    #isNaN;
    #isFinite;
    #isInteger;
    #number;
    #integer;
    #bigint;
    #string;
    #binary;
    #hexadecimal;
    #octal;

    // XXX from buffer, bigint
    // XXX round mode
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

        if ( value instanceof Numeric ) {
            this.#decimal = value[ decimalProperty ];
        }
        else if ( Decimal.isDecimal( value ) ) {
            this.#decimal = value;
        }
        else {
            this.#decimal = CustomDecimal( value );
        }

        const realPrecision = this.#decimal.precision(),
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

    // XXX
    static parseInt ( value, options = {} ) {
        return new this( value, {
            ...options,
            "scale": 0,
        } );
    }

    // XXX
    static parseFloat ( value, options ) {
        return new this( value, options );
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
        return this.#decimal.isPositiveInfinity();
    }

    get isNegativeInfinity () {
        return this.#decimal.isNegativeInfinity();
    }

    get isFinite () {
        this.#isFinite ??= this.#decimal.isFinite();

        return this.#isFinite;
    }

    // XXX test NaN
    get isNumber () {
        return this.isFinite;
    }

    get isInteger () {
        this.#isInteger ??= this.#decimal.isInteger();

        return this.#isInteger();
    }

    get isSafeInteger () {
        return Number.isSafeInteger( this.number );
    }

    get isZero () {
        return this.#decimal.isZero();
    }

    get isNegative () {
        return this.#decimal.isNegative();
    }

    get isPositive () {
        return this.#decimal.isPositive();
    }

    get realPrecision () {
        return this.#decimal.precision();
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
                this.#integer = this.toPrecision( this.precision, 0 );
            }
        }

        return this.#integer;
    }

    get bigint () {
        if ( this.#bigint == null ) {

            // not a number
            if ( !this.isNumber ) {
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
        return this.#decimal.toFixed( scale );
    }

    // XXX inherit precision
    toPrecision ( precision, scale ) {
        return new this.constructor( this.#decimal, {
            precision,
            scale,
        } );
    }

    // XXX ???
    toExponential ( scale ) {
        return this.#decimal.toExponential( scale );
    }

    add ( value ) {
        return this.#clone( this.#decimal.add( value ) );
    }

    subtract ( value ) {
        return this.#clone( this.#decimal.sub( value ) );
    }

    multiply ( value ) {
        return this.#clone( this.#decimal.mul( value ) );
    }

    divide ( value ) {
        return this.#clone( this.#decimal.div( value ) );
    }

    abs () {
        return this.#clone( this.#decimal.abs() );
    }

    mod () {
        return this.#clone( this.#decimal.mod() );
    }

    trunc ( scale ) {
        if ( scale ) {
            const multiplier = 10 ** scale;

            return this.#clone( this.#decimal.muliple( multiplier ).trunc().divide( multiplier ) );
        }
        else {
            return this.#clone( this.#decimal.trunc() );
        }
    }

    round ( scale ) {
        if ( scale ) {
            const multiplier = 10 ** scale;

            return this.#clone( this.#decimal.muliple( multiplier ).round().divide( multiplier ) );
        }
        else {
            return this.#clone( this.#decimal.round() );
        }
    }

    floor ( scale ) {
        if ( scale ) {
            const multiplier = 10 ** scale;

            return this.#clone( this.#decimal.muliple( multiplier ).floor().divide( multiplier ) );
        }
        else {
            return this.#clone( this.#decimal.floor() );
        }
    }

    ceil ( scale ) {
        if ( scale ) {
            const multiplier = 10 ** scale;

            return this.#clone( this.#decimal.muliple( multiplier ).ceil().divide( multiplier ) );
        }
        else {
            return this.#clone( this.#decimal.ceil() );
        }
    }

    // XXX compare functions

    // private
    get [ decimalProperty ] () {
        return this.#decimal;
    }

    #clone ( value ) {
        return new this.constructor( value, {
            "precision": this.#precision,
            "scale": this.#scale,
        } );
    }
}
