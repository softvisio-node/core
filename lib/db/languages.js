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

const IDX = {};

const DATA = require( __dirname + "/../../resources/languages.json" );

for ( const id in DATA ) {
    const language = new Language( DATA[id] );

    IDX[language.id] = language;
    IDX[language.name.toLowerCase()] = language;
    if ( language.iso2 ) IDX[language.iso2] = language;
    if ( language.bibliographic ) IDX[language.bibliographic] = language;
}

class Languages {
    get ( id ) {
        return IDX[id.toLowerCase()];
    }
}

module.exports = new Languages();
