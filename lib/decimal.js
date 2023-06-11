export default class Decimal {
    #precision;
    #multiplier;
    #bigIntMultiplier;

    constructor ( precision ) {
        this.#precision = precision || 6;
        this.#multiplier = 10 ** this.#precision;
        this.#bigIntMultiplier = BigInt( this.#multiplier );
    }

    // properties
    get precision () {
        return this.#precision;
    }

    // public
    add ( a, b ) {
        if ( Number.isInteger( a ) && Number.isInteger( b ) ) return a + b;

        a = this.#toBigInt( a );
        b = this.#toBigInt( b );

        return this.#toNumber( a + b );
    }

    subtract ( a, b ) {
        if ( Number.isInteger( a ) && Number.isInteger( b ) ) return a - b;

        a = this.#toBigInt( a );
        b = this.#toBigInt( b );

        return this.#toNumber( a - b );
    }

    // private
    #toBigInt ( number ) {
        if ( Number.isInteger( number ) ) {
            return BigInt( number ) * this.#bigIntMultiplier;
        }
        else {
            const [integer, fractional] = number.toFixed( this.#precision ).split( "." );

            return BigInt( integer ) * this.#bigIntMultiplier + BigInt( fractional );
        }
    }

    #toNumber ( value ) {
        const integer = value / this.#bigIntMultiplier,
            fractional = value - integer * this.#bigIntMultiplier;

        return Number( integer + "." + fractional );
    }
}
