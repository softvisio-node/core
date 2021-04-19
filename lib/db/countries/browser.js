const Country = require( "./country" );

const IDX = {};

const DATA = require( "#resources/countries.json" );

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
}

module.exports = new Countries();
