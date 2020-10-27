// NOTE source: /usr/share/iso_files/json/iso_639-*.json

class Language {
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

    get name () {
        return this.#data.name;
    }

    get bibliographic () {
        return this.#data.bibliographic;
    }
}

const ID_IDX = {};
const NAME_IDX = {};

const DATA = require( __dirname + "/../../resources/languages.json" );

for ( const id in DATA ) {
    const language = new Language( DATA[id] );

    ID_IDX[language.id] = language;
    if ( language.iso2 ) ID_IDX[language.iso2] = language;
    if ( language.bibliographic ) ID_IDX[language.bibliographic] = language;
    NAME_IDX[language.name.toLowerCase()] = language;
}

class Languages {
    getById ( id ) {
        return ID_IDX[id];
    }

    getByName ( name ) {
        return NAME_IDX[name.toLowerCase()];
    }
}

module.exports = new Languages();
