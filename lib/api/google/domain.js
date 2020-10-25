const DATA = require( __dirname + "/../../../resources/google-domain.json" );

class Data {
    #asArray;

    getAsArray () {
        if ( !this.#asArray ) {
            this.#asArray = [];

            for ( const iso2 in DATA ) {
                this.#asArray.push( {
                    "id": iso2,
                    iso2,
                    "country": DATA[iso2].country,
                    "tld": DATA[iso2].tld,
                    "googleDomain": DATA[iso2].googleDomain,
                } );
            }
        }

        return this.#asArray;
    }

    getByISO2 ( iso2 ) {
        return DATA[iso2 || ""];
    }
}

module.exports = new Data();
