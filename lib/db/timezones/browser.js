const { IANAZone, DateTime, Duration } = require( "luxon" );

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

const DATA = require( __dirname + "/../../../resources/timezones.json" );

for ( const id in DATA ) {
    const tz = new Timezone( DATA[id] );

    IDX[tz.id.toLowerCase()] = tz;
}

class Timezones {
    #asArray;

    toArray () {
        if ( !this.#asArray ) {
            this.#asArray = Object.keys( DATA ).map( id => {
                const tz = this.get( id );

                return {
                    "value": id,
                    "text": tz.text,
                    "timezone": tz,
                };
            } );
        }

        return this.#asArray;
    }

    get ( id ) {
        return IDX[id.toLowerCase()];
    }
}

module.exports = new Timezones();
