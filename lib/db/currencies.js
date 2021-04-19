class Currency {
    #data;

    constructor ( data ) {
        this.#data = data;
    }

    get id () {
        return this.#data.id;
    }

    get name () {
        return this.#data.name;
    }

    get symbol () {
        return this.#data.symbol;
    }
}

const IDX = {};

const DATA = require( "#resources/currencies.json" );

for ( const id in DATA ) {
    const currency = new Currency( DATA[id] );

    IDX[currency.id.toLowerCase()] = currency;
    IDX[currency.name.toLowerCase()] = currency;
    IDX[currency.symbol] = currency;
}

class Currencies {
    get ( id ) {
        return IDX[id.toLowerCase()];
    }
}

module.exports = new Currencies();
