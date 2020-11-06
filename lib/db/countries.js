class Countries extends require( "./countries/browser" ).constructor {
    getByCoordinates ( coordinates ) {
        const wc = require( "which-country" );

        const iso3 = wc( [coordinates.longitude, coordinates.latitude] );

        return this.get( iso3 );
    }
}

module.exports = new Countries();
