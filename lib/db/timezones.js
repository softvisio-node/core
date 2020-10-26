const DATA = require( __dirname + "/../../resources/timezones.json" );
const { DateTime } = require( "luxon" );

let GEO_TZ;
const GEO_TZ_CACHE = new Map();

class Timezone {
    #data;

    constructor ( data ) {
        this.#data = data;
    }

    get id () {
        return this.#data.id;
    }

    get name () {
        return this.#data.name;
    }

    get abbr () {
        return this.#data.abbr;
    }

    get offset () {
        const date = DateTime.fromObject( { "zone": this.#data.id } );

        return date.offset;
    }

    toString () {
        return this.name;
    }
}

class Timezones {
    #objects = {};
    #asArray;

    toArray () {
        if ( !this.#asArray ) {
            this.#asArray = Object.keys( DATA ).map( id => this.getById( id ) );
        }

        return this.#asArray;
    }

    getById ( id ) {
        const data = DATA[id];

        if ( !data ) return;

        if ( !this.#objects[id] ) this.#objects[id] = new Timezone( data );

        return this.#objects[id];
    }

    getByCoordinates ( coordinates ) {
        if ( !GEO_TZ ) {
            GEO_TZ = require( "geo-tz" );

            GEO_TZ.setCache( { "store": GEO_TZ_CACHE } );
        }

        let timezones = GEO_TZ( coordinates.latitude, coordinates.longtitude );

        if ( timezones ) timezones = timezones.map( timezone => this.getById( timezone ) );

        return timezones;
    }
}

module.exports = new Timezones();
