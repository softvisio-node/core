const DATA = require( __dirname + "/../../resources/countries.json" );
const CONST = require( "../const" );

class Country {
    static [CONST.OBJECT_ID_COUNTRY] = true;

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

    get name () {
        return this.#data.name;
    }
}

class Countries {
    #objects = {};
    #idIso2;
    #idName;

    getById ( id ) {
        return this._getObject( id.toLowerCase() );
    }

    getByIso2 ( iso2 ) {
        if ( !this.#idIso2 ) {
            this.#idIso2 = Object.fromEntries( Object.keys( DATA )
                .filter( id => DATA[id].iso2 )
                .map( id => [DATA[id].iso2, id] ) );
        }

        return this._getObject( this.#idIso2[iso2.toUpperCase()] );
    }

    getByName ( name ) {
        if ( !this.#idName ) {
            this.#idName = Object.fromEntries( Object.keys( DATA ).map( id => [DATA[id].name.toLowerCase(), id] ) );
        }

        return this._getObject( this.#idName[name.toLowerCase()] );
    }

    _getObject ( id ) {
        const data = DATA[id];

        if ( !data ) return null;

        if ( !this.#objects[id] ) this.#objects[id] = new Country( data );

        return this.#objects[id];
    }
}

module.exports = new Countries();
