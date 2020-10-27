const CONST = require( "../const" );

class Country {
    static [CONST.OBJECT_IS_COUNTRY] = true;

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

    get iso2 () {
        return this.#data.iso2;
    }
}

const IDX = {};

const DATA = require( __dirname + "/../../resources/countries.json" );

for ( const id in DATA ) {
    const country = new Country( DATA[id] );

    IDX[country.id] = country;
    IDX[country.iso2.toLowerCase()] = country;
    IDX[country.iso3.toLowerCase()] = country;
    IDX[country.ison] = country;
    IDX[country.name.toLowerCase()] = country;
}

class Countries {
    get ( id ) {
        return IDX[id.toLowerCase()];
    }
}

module.exports = new Countries();
