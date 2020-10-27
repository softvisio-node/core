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

const ID_IDX = {};
const NAME_IDX = {};
const SYMBOL_IDX = {};

const DATA = require( __dirname + "/../../resources/currencies.json" );

for ( const id in DATA ) {
    const currency = new Currency( DATA[id] );

    ID_IDX[currency.id] = currency;
    NAME_IDX[currency.name] = currency;
    SYMBOL_IDX[currency.symbol] = currency;
}

class Currencies {
    getById ( id ) {
        return ID_IDX[id];
    }

    getByName ( name ) {
        return NAME_IDX[name];
    }

    getBySymbol ( symbol ) {
        return SYMBOL_IDX[symbol];
    }
}

module.exports = new Currencies();
