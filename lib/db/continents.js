class Continent {
    #data;

    constructor ( data ) {
        this.#data = data;
    }

    get id () {
        return this.#data.id;
    }

    get iso2 () {
        return this.#data.id;
    }

    get name () {
        return this.#data.name;
    }
}

const IDX = {};

const DATA = require( __dirname + "/../../resources/continents.json" );

for ( const id in DATA ) {
    const object = new Continent( DATA[id] );

    IDX[object.id.toLowerCase()] = object;
    IDX[object.name.toLowerCase()] = object;
}

class Continents {
    get ( id ) {
        return IDX[id.toLowerCase()];
    }
}

module.exports = new Continents();
