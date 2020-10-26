const DATA = require( __dirname + "/../../../resources/timezones.json" );
const { IANAZone, DateTime, Duration } = require( "luxon" );

class Timezone extends IANAZone {
    #text;
    #abbr;

    constructor ( data ) {
        super( data.id );

        this.#text = data.text;
        this.#abbr = data.abbr;
    }

    get id () {
        return this.name;
    }

    get text () {
        return this.#text;
    }

    get abbr () {
        return this.#abbr;
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
        return this.text;
    }
}

class TimezonesBrowser {
    #objects = {};
    #asArray;

    toArray () {
        if ( !this.#asArray ) {
            this.#asArray = Object.keys( DATA ).map( id => {
                const tz = this.getById( id );

                return {
                    id,
                    "name": tz.text,
                    "timezone": tz,
                };
            } );
        }

        return this.#asArray;
    }

    getById ( id ) {
        const data = DATA[id];

        if ( !data ) return;

        if ( !this.#objects[id] ) this.#objects[id] = new Timezone( data );

        return this.#objects[id];
    }
}

module.exports = new TimezonesBrowser();

module.exports.TimezonesBrowser = TimezonesBrowser;
