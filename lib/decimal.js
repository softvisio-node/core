export default class Decimal {
    #precision;
    #miltuplier;
    #bigIntMiltuplier;

    constructor ( precision ) {
        this.#precision = precision || 6;
        this.#miltuplier = 10 ** this.#precision;
        this.#bigIntMiltuplier = BigInt( this.#miltuplier );
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
    // XXX
    #toBigInt ( number ) {
        return BigInt( Math.floor( number * this.#miltuplier ) );
    }

    #toNumber ( value ) {
        const integer = value / this.#bigIntMiltuplier,
            fractional = value - integer * this.#bigIntMiltuplier;

        return Number( integer + "." + fractional );
    }
}
