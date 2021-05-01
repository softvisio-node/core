import fs from "#lib/fs";

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

const DATA = fs.config.read( "#resources/currencies.json", { "resolve": import.meta.url } );

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

export default new Currencies();
