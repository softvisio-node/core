const maxmind = require( "maxmind" );
const fs = require( "fs" );

var COUNTRY;
var CITY;

// npm i https://github.com/GitSquared/node-geolite2-redist

class Maxmind {
    get country () {
        if ( !COUNTRY ) {
            const geolite2 = require( "geolite2-redist" );

            COUNTRY = geolite2.open( "GeoLite2-Country", path => {
                const buf = fs.readFileSync( path );

                return new maxmind.Reader( buf );
            } );
        }

        return COUNTRY;
    }

    get city () {
        if ( !COUNTRY ) {
            const geolite2 = require( "geolite2-redist" );

            CITY = geolite2.open( "GeoLite2-City", path => {
                const buf = fs.readFileSync( path );

                return new maxmind.Reader( buf );
            } );
        }

        return CITY;
    }
}

module.exports = new Maxmind();
