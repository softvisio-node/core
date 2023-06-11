export default class Decimal {
    #precision;
    #miltuplier;
    #bigIntMultiplier;

    constructor ( precision ) {
        this.#precision = precision || 6;
        this.#miltuplier = 10 ** this.#precision;
        this.#bigIntMultiplier = BigInt( this.#miltuplier );
    }

    // properties
    get precision () {
        return this.#precision;
    }

    // public
    subtract ( a, b ) {
        a = this.#toBigInt( a );
        b = this.#toBigInt( b );

        return this.#toNumber( a - b );
    }

    // private
    #toBigInt ( number ) {
        const [integer, fractional] = number.toFixed( this.#precision ).split( "." );

        return BigInt( integer ) * this.#bigIntMultiplier + BigInt( fractional );
    }

    #toNumber ( value ) {
        const integer = value / this.#bigIntMultiplier,
            fractional = value - integer * this.#bigIntMultiplier;

        return Number( integer + "." + fractional );
    }
}
