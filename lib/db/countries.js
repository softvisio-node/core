import fs from "#lib/fs";
import WHICH_COUNTRY from "which-country";

class Country {
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

    get coordinates () {
        return this.#data.coordinates;
    }
}

const IDX = {};
const DATA = fs.config.read( "#resources/countries.json", { "resolve": import.meta.url } );

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
        if ( !id ) return;

        return IDX[id.toLowerCase()];
    }

    getByCoordinates ( coordinates ) {
        const iso3 = WHICH_COUNTRY( [coordinates.longitude, coordinates.latitude] );

        return this.get( iso3 );
    }
}

export default new Countries();
