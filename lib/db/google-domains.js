const countries = require( "./countries" );

class GoogleDomain {
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
        if ( !this.#country ) this.#country = countries.get( this.id );

        return this.#country;
    }
}

const IDX = {};

const DATA = require( __dirname + "/../../resources/google-domains.json" );

for ( const id in DATA ) {
    const domain = new GoogleDomain( DATA[id] );

    IDX[domain.id.toLowerCase()] = domain;
    IDX[domain.tld] = domain;
    IDX[domain.domain] = domain;
}

class GoogleDomains {
    #asArray;

    toArray () {
        if ( !this.#asArray ) {
            this.#asArray = Object.keys( DATA ).map( id => {
                const domain = this.get( id );

                return {
                    "value": id,
                    "text": domain.country.name,
                    domain,
                };
            } );
        }

        return this.#asArray;
    }

    get ( id ) {
        return IDX[id.toLowerCase()];
    }
}

module.exports = new GoogleDomains();
