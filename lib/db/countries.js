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

    get iso2 () {
        return this.#data.iso2;
    }

    get iso3 () {
        return this.#data.iso3;
    }

    get ison () {
        return this.#data.ison;
    }

    get name () {
        return this.#data.name;
    }

    get officialName () {
        return this.#data.officialName;
    }

    get flag () {
        return this.#data.flag;
    }

    get flagUnicode () {
        return this.#data.flagUnicode;
    }

    get tld () {
        return this.#data.tld;
    }

    get callingCode () {
        return this.#data.callingCode;
    }
}

const IDX = {};

const DATA = require( __dirname + "/../../resources/countries.json" );

for ( const id in DATA ) {
    const country = new Country( DATA[id] );

    IDX[country.id.toLowerCase()] = country;
    if ( country.iso3 ) IDX[country.iso3.toLowerCase()] = country;
    if ( country.ison ) IDX[country.ison] = country;
    IDX[country.name.toLowerCase()] = country;
    IDX[country.officialName.toLowerCase()] = country;
    if ( country.tld ) IDX[country.tld] = country;
    if ( country.callingCode ) IDX[country.callingCode] = country;
}

class Countries {
    get ( id ) {
        return IDX[id.toLowerCase()];
    }

    // XXX
    getByCoordinates () {}
}

module.exports = new Countries();
