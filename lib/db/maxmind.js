const maxmind = require( "maxmind" );
const fs = require( "../fs" );

var GEOLITE2;
var UPDATER;
var COUNTRY;
var CITY;
var ASN;

class Maxmind {
    get _geolite2 () {
        if ( !GEOLITE2 ) {
            GEOLITE2 = require( "geolite2-redist" );

            UPDATER = new GEOLITE2.UpdateSubscriber();

            UPDATER._checker.unref();

            UPDATER.on( "update", () => {
                COUNTRY = null;
                CITY = null;
                ASN = null;
            } );
        }

        return GEOLITE2;
    }

    get country () {
        if ( !COUNTRY ) {
            const buf = fs.readFileSync( this._geolite2.paths["GeoLite2-Country"] );

            COUNTRY = new maxmind.Reader( buf );
        }

        return COUNTRY;
    }

    get city () {
        if ( !CITY ) {
            const buf = fs.readFileSync( this._geolite2.paths["GeoLite2-City"] );

            CITY = new maxmind.Reader( buf );
        }

        return CITY;
    }

    get asn () {
        if ( !ASN ) {
            const buf = fs.readFileSync( this._geolite2.paths["GeoLite2-ASN"] );

            ASN = new maxmind.Reader( buf );
        }

        return ASN;
    }
}

module.exports = new Maxmind();
