import fs from "#lib/fs";
import { IANAZone, DateTime, Duration } from "luxon";
import GEO_TZ from "geo-tz";

GEO_TZ.setCache( { "store": new Map() } );

class Timezone extends IANAZone {
    #data;

    constructor ( data ) {
        super( data.id );

        this.#data = data;
    }

    get id () {
        return this.name;
    }

    get text () {
        return this.#data.text;
    }

    get abbr () {
        return this.#data.abbr;
    }

    // XXX cache???
    get offsetMinutes () {
        const offset = DateTime.fromObject( { "zone": this } ).offset;

        return offset;
    }

    // XXX cache???
    get offsetHours () {
        const offset = this.offsetMinutes;

        if ( offset < 0 ) return "-" + Duration.fromObject( { "minutes": Math.abs( offset ) } ).toFormat( "hh:mm" );
        else if ( offset > 0 ) return "+" + Duration.fromObject( { "minutes": offset } ).toFormat( "hh:mm" );
        else return "±" + Duration.fromObject( { "minutes": offset } ).toFormat( "hh:mm" );
    }

    toString () {
        return this.name;
    }
}

const IDX = {};
const DATA = fs.config.read( "#resources/timezones.json", { "resolve": import.meta.url } );

for ( const id in DATA ) {
    const tz = new Timezone( DATA[id] );

    IDX[tz.id.toLowerCase()] = tz;
}

class Timezones {
    get ( id ) {
        return IDX[id.toLowerCase()];
    }

    getByCoordinates ( coordinates ) {
        let timezones = GEO_TZ( coordinates.latitude, coordinates.longitude );

        if ( timezones ) timezones = timezones.map( id => this.get( id ) );

        return timezones;
    }
}

export default new Timezones();
