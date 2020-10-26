const { TimezonesBrowser } = require( "./timezones/browser" );

let GEO_TZ;
const GEO_TZ_CACHE = new Map();

class Timezones extends TimezonesBrowser {
    getByCoordinates ( coordinates ) {
        if ( !GEO_TZ ) {
            GEO_TZ = require( "geo-tz" );

            GEO_TZ.setCache( { "store": GEO_TZ_CACHE } );
        }

        let timezones = GEO_TZ( coordinates.latitude, coordinates.longtitude );

        if ( timezones ) timezones = timezones.map( id => this.getById( id ) );

        return timezones;
    }
}

module.exports = new Timezones();
