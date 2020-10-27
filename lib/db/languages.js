class Language {
    #data;

    constructor ( data ) {
        this.#data = data;
    }

    get id () {
        return this.#data.id;
    }

    get iso639_1 () {
        return this.#data["639-1"];
    }

    get iso639_2 () {
        return this.#data["639-2"];
    }

    get family () {
        return this.#data.family;
    }

    get name () {
        return this.#data.name;
    }

    get nativeName () {
        return this.#data.nativeName;
    }
}

const ID_IDX = {};
const ISO639_2_IDX = {};
const NAME_IDX = {};
const NATIVE_NAME_IDX = {};

const DATA = require( __dirname + "/../../resources/languages.json" );

for ( const id in DATA ) {
    const language = new Language( DATA[id] );

    ID_IDX[language.id] = language;
    ISO639_2_IDX[language.iso639_2] = language;
    NAME_IDX[language.name] = language;
    NATIVE_NAME_IDX[language.nativeName] = language;
}

class Languages {
    getById ( id ) {
        return ID_IDX[id];
    }

    getByIso639_1 ( iso639_1 ) {
        return ID_IDX[iso639_1];
    }

    getByIso639_2 ( iso639_2 ) {
        return ISO639_2_IDX[iso639_2];
    }

    getByName ( name ) {
        return NAME_IDX[name];
    }

    getByNativeName ( nativeName ) {
        return NATIVE_NAME_IDX[nativeName];
    }
}

module.exports = new Languages();
