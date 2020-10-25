const DATA = require( __dirname + "/../../resources/google-domain.json" );

const WORLDWIDE_ID = "WORLDWIDE";

class Data {
    #asArray;

    getAsArray () {
        if ( !this.#asArray ) {
            this.#asArray = [];

            for ( const id in DATA ) {
                const rec = DATA[id];

                this.#asArray.push( {
                    id,
                    "iso2": rec.iso2,
                    "country": rec.country,
                    "tld": rec.tld,
                    "googleDomain": rec.googleDomain,
                } );
            }
        }

        return this.#asArray;
    }

    getById ( id ) {
        return DATA[id];
    }

    getByIso2 ( iso2 ) {
        return DATA[iso2 || WORLDWIDE_ID];
    }
}

module.exports = new Data();
