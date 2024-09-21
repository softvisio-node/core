import Decimal from "decimal.js";

const decimalProperty = Symbol();

export default class Numeric {
    #decimal;
    #precision;
    #scale;
    #isNaN;
    #isFinite;
    #isInteger;

    constructor ( value, { precision, scale } = {} ) {
        this.#precision = precision;
        this.#scale = scale;

        this.#parse( value );
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
        return this.#isNaN;
    }

    get isFinite () {
        return this.#isFinite;
    }

    get isInteger () {
        return this.#isInteger();
    }

    // public
    toString () {
        return this.#decimal.toString();
    }

    toJSON () {
        return this.#decimal.toJSON();
    }

    valueOf () {
        return this.#decimal.valueOf();
    }

    toNumber () {
        return this.#decimal.toNumber();
    }

    toFixed ( scale ) {
        return this.#decimal.toFixed( scale );
    }

    toPrecision ( precision, scale ) {
        return new this( this.#decimal, {
            precision,
            scale,
        } );
    }

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

    // private
    get [ decimalProperty ] () {
        return this.#decimal;
    }

    // XXX check precision
    #parse ( value ) {
        if ( Decimal.isDecimal( value ) ) {
            this.#decimal = value;
        }
        else {
            this.#decimal = Decimal( value );
        }

        this.#isNaN = this.#decimal.isNaN();
        this.#isFinite = this.#decimal.isFinite();
        this.#isInteger = this.#decimal.isInteger();
    }

    #clone ( value ) {
        return new this.constructor( value, {
            "precision": this.#precision,
            "scale": this.#scale,
        } );
    }
}
