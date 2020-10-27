const timezones = require( "./timezones/browser" );

let GEO_TZ;
const GEO_TZ_CACHE = new Map();

class Timezones extends timezones.constructor {
    getByCoordinates ( coordinates ) {

        // init
        if ( !GEO_TZ ) {
            GEO_TZ = require( "geo-tz" );

            GEO_TZ.setCache( { "store": GEO_TZ_CACHE } );
        }

        let timezones = GEO_TZ( coordinates.latitude, coordinates.longtitude );

        if ( timezones ) timezones = timezones.map( id => this.get( id ) );

        return timezones;
    }
}

module.exports = new Timezones();
