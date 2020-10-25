const DATA = require( __dirname + "/../../resources/google-domains.json" );
const countries = require( "./countries" );
const CONST = require( "../const" );

class GoogleDomain {
    static [CONST.OBJECT_ID_GOOGLE_DOMAIN] = true;

    #data;
    #country;

    constructor ( data ) {
        this.#data = data;
    }

    get id () {
        return this.#data.id;
    }

    get tld () {
        return this.#data.tld;
    }

    get domain () {
        return this.#data.domain;
    }

    get country () {
        if ( !this.#country ) this.#country = countries.getById( this.id );

        return this.#country;
    }
}

class GoogleDomains {
    #objects = {};
    #asArray;

    toArray () {
        if ( !this.#asArray ) {
            this.#asArray = Object.keys( DATA ).map( id => {
                return { ...DATA[id], "country": this.getById( id ).country };
            } );
        }

        return this.#asArray;
    }

    getById ( id ) {
        return this._getObject( id.toLowerCase() );
    }

    _getObject ( id ) {
        const data = DATA[id];

        if ( !data ) return null;

        if ( !this.#objects[id] ) this.#objects[id] = new GoogleDomain( data );

        return this.#objects[id];
    }
}

module.exports = new GoogleDomains();
