import CacheLru from "#lib/cache/lru";
import Numeric from "#lib/numeric";

var cache;

const UNITS = {
        "years": {
            "singular": "year",
            "milliseconds": 1000 * 60 * 60 * 24 * 365,
            "nginx": "y",
            "duration": true,
        },
        "months": {
            "singular": "month",
            "milliseconds": 1000 * 60 * 60 * 24 * 30,
            "nginx": "M",
            "duration": true,
        },
        "weeks": {
            "singular": "week",
            "milliseconds": 1000 * 60 * 60 * 24 * 7,
            "nginx": "w",
            "duration": true,
        },
        "days": {
            "singular": "day",
            "milliseconds": 1000 * 60 * 60 * 24,
            "nginx": "d",
            "duration": true,
        },
        "hours": {
            "singular": "hour",
            "milliseconds": 1000 * 60 * 60,
            "nginx": "h",
            "duration": true,
        },
        "minutes": {
            "singular": "minute",
            "milliseconds": 1000 * 60,
            "nginx": "m",
            "duration": true,
        },
        "seconds": {
            "singular": "second",
            "milliseconds": 1000,
            "nginx": "s",
            "duration": true,
        },
        "milliseconds": {
            "singular": "millisecond",
            "milliseconds": 1,
            "nginx": "ms",
            "duration": false,
        },
        "microseconds": {
            "singular": "microsecond",
            "milliseconds": 1 / 1000,
            "nginx": null,
            "duration": false,
        },
        "nanoseconds": {
            "singular": "nanosecond",
            "milliseconds": 1 / 1_000_000,
            "nginx": null,
            "duration": false,
        },
    },
    EMPTY_UNIT = "seconds",
    ALIASES = {};

// create aliases
for ( const name in UNITS ) {
    UNITS[ name ].name = name;

    ALIASES[ name ] = name;
    ALIASES[ UNITS[ name ].singular ] = name;
}

export default class Interval {
    #units = {};
    #normalizedUnits;
    #string;
    #nginx;
    #formatRelativeDateParams;
    #formatDurationParams;
    #_toUnit = {};

    constructor ( duration, { unit = "milliseconds" } = {} ) {
        const { years, months, weeks, days, hours, minutes, seconds, milliseconds, microseconds, nanoseconds } = this.#parse( duration, unit );

        this.#units.years = Math.trunc( years || 0 );
        this.#units.months = Math.trunc( months || 0 );
        this.#units.weeks = Math.trunc( weeks || 0 );
        this.#units.days = Math.trunc( days || 0 );
        this.#units.hours = Math.trunc( hours || 0 );
        this.#units.minutes = Math.trunc( minutes || 0 );
        this.#units.seconds = Math.trunc( seconds || 0 );
        this.#units.milliseconds = Math.trunc( milliseconds || 0 );
        this.#units.microseconds = Math.trunc( microseconds || 0 );
        this.#units.nanoseconds = Math.trunc( nanoseconds || 0 );

        // nanoseconds -> microseconds
        if ( Math.abs( this.#units.nanoseconds ) >= 1000 ) {
            this.#units.microseconds += Math.trunc( this.#units.nanoseconds / 1000 );
            this.#units.nanoseconds = this.#units.nanoseconds % 1000;
        }

        // microseconds -> milliseconds
        if ( Math.abs( this.#units.microseconds ) >= 1000 ) {
            this.#units.milliseconds += Math.trunc( this.#units.microseconds / 1000 );
            this.#units.microseconds = this.#units.microseconds % 1000;
        }

        // milliseconds -> seconds
        if ( Math.abs( this.#units.milliseconds ) >= 1000 ) {
            this.#units.seconds += Math.trunc( this.#units.milliseconds / 1000 );
            this.#units.milliseconds = this.#units.milliseconds % 1000;
        }

        // seconds -> minutes
        if ( Math.abs( this.#units.seconds ) >= 60 ) {
            this.#units.minutes += Math.trunc( this.#units.seconds / 60 );
            this.#units.seconds = this.#units.seconds % 60;
        }

        // minutes -> hours
        if ( Math.abs( this.#units.minutes ) >= 60 ) {
            this.#units.hours += Math.trunc( this.#units.minutes / 60 );
            this.#units.minutes = this.#units.minutes % 60;
        }

        // hours -> days
        if ( Math.abs( this.#units.hours ) >= 24 ) {
            this.#units.days += Math.trunc( this.#units.hours / 24 );
            this.#units.hours = this.#units.hours % 24;
        }

        // days -> weeks
        if ( Math.abs( this.#units.days ) >= 7 ) {
            this.#units.weeks += Math.trunc( this.#units.days / 7 );
            this.#units.days = this.#units.days % 7;
        }

        // months -> years
        if ( Math.abs( this.#units.months ) >= 12 ) {
            this.#units.years += Math.trunc( this.#units.months / 12 );
            this.#units.months = this.#units.months % 12;
        }
    }

    // static
    static new ( duration, { unit } = {} ) {
        if ( duration instanceof this ) return duration;

        return new this( duration, { unit } );
    }

    static get compare () {
        return ( a, b ) => this.new( a ).compare( b );
    }

    // properties
    get hasValue () {
        return this.toMilliseconds() || this.#units.microseconds || this.#units.nanoseconds;
    }

    get years () {
        return this.#units.years;
    }

    get months () {
        return this.#units.months;
    }

    get weeks () {
        return this.#units.weeks;
    }

    get days () {
        return this.#units.days;
    }

    get hours () {
        return this.#units.hours;
    }

    get minutes () {
        return this.#units.minutes;
    }

    get seconds () {
        return this.#units.seconds;
    }

    get milliseconds () {
        return this.#units.milliseconds;
    }

    get microseconds () {
        return this.#units.microseconds;
    }

    get nanoseconds () {
        return this.#units.nanoseconds;
    }

    // public
    toString () {
        if ( this.#string == null ) {
            const units = [];

            for ( const [ name, unit ] of Object.entries( UNITS ) ) {
                const value = this.#units[ name ];

                if ( !value ) continue;

                units.push( value + " " + ( Math.abs( value ) === 1
                    ? unit.singular
                    : name ) );
            }

            if ( units.length ) {
                this.#string = units.join( " " );
            }
            else {
                this.#string = "0 " + EMPTY_UNIT;
            }
        }

        return this.#string;
    }

    toJSON () {
        return this.toString();
    }

    toNginx () {
        if ( this.#nginx == null ) {
            const units = [];

            for ( const [ name, unit ] of Object.entries( UNITS ) ) {
                if ( !this.#units[ name ] || !unit.nginx ) continue;

                units.push( this.#units[ name ] + unit.nginx );
            }

            this.#nginx = units.join( "" );
        }

        return this.#nginx;
    }

    toMilliseconds () {
        return this.#toUnit( "milliseconds" );
    }

    toSeconds () {
        return this.#toUnit( "seconds" );
    }

    toMinutes () {
        return this.#toUnit( "minutes" );
    }

    toHours () {
        return this.#toUnit( "hours" );
    }

    toDays () {
        return this.#toUnit( "days" );
    }

    toWeeks () {
        return this.#toUnit( "weeks" );
    }

    toMonths () {
        return this.#toUnit( "months" );
    }

    toYears () {
        return this.#toUnit( "years" );
    }

    getFormatRelativeDateParams () {
        if ( !this.#formatRelativeDateParams ) {
            const units = this.#getNormalizedUnits();

            for ( const unit of Object.values( UNITS ) ) {
                if ( !unit.duration || !units[ unit.name ] ) continue;

                this.#formatRelativeDateParams = [ units[ unit.name ], unit.name ];

                break;
            }

            // default
            this.#formatRelativeDateParams ||= [ 0, EMPTY_UNIT ];
        }

        return this.#formatRelativeDateParams;
    }

    getFormatDurationParams () {
        if ( !this.#formatDurationParams ) {
            const units = this.#getNormalizedUnits();

            this.#formatDurationParams = {};

            let found;

            for ( const [ unit, value ] of Object.entries( units ) ) {
                if ( !value ) continue;

                found = true;

                this.#formatDurationParams[ unit ] = value;
            }

            if ( !found ) this.#formatDurationParams[ EMPTY_UNIT ] = 0;
        }

        return this.#formatDurationParams;
    }

    addDate ( date ) {
        date = new Date( date ?? Date.now() );

        if ( this.#units.years ) date.setFullYear( date.getFullYear() + this.#units.years );
        if ( this.#units.months ) date.setMonth( date.getMonth() + this.#units.months );
        if ( this.#units.weeks ) date.setDate( date.getDate() + this.#units.weeks * 7 );
        if ( this.#units.days ) date.setDate( date.getDate() + this.#units.days );
        if ( this.#units.hours ) date.setHours( date.getHours() + this.#units.hours );
        if ( this.#units.minutes ) date.setMinutes( date.getMinutes() + this.#units.minutes );
        if ( this.#units.seconds ) date.setSeconds( date.getSeconds() + this.#units.seconds );
        if ( this.#units.milliseconds ) date.setMilliseconds( date.getMilliseconds() + this.#units.milliseconds );

        return date;
    }

    subtractDate ( date ) {
        date = new Date( date ?? Date.now() );

        if ( this.#units.years ) date.setFullYear( date.getFullYear() - this.#units.years );
        if ( this.#units.months ) date.setMonth( date.getMonth() - this.#units.months );
        if ( this.#units.weeks ) date.setDate( date.getDate() - this.#units.weeks * 7 );
        if ( this.#units.days ) date.setDate( date.getDate() - this.#units.days );
        if ( this.#units.hours ) date.setHours( date.getHours() - this.#units.hours );
        if ( this.#units.minutes ) date.setMinutes( date.getMinutes() - this.#units.minutes );
        if ( this.#units.seconds ) date.setSeconds( date.getSeconds() - this.#units.seconds );
        if ( this.#units.milliseconds ) date.setMilliseconds( date.getMilliseconds() - this.#units.milliseconds );

        return date;
    }

    addInterval ( interval ) {
        interval = this.constructor.new( interval );

        const units = {};

        for ( const unit in UNITS ) {
            units[ unit ] = this[ unit ] + interval[ unit ];
        }

        return new this.constructor( units );
    }

    subtractInterval ( interval ) {
        interval = this.constructor.new( interval );

        const units = {};

        for ( const unit in UNITS ) {
            units[ unit ] = this[ unit ] - interval[ unit ];
        }

        return new this.constructor( units );
    }

    compare ( interval ) {
        interval = this.constructor.new( interval );

        return this.toMilliseconds() - interval.toMilliseconds();
    }

    // private
    #parse ( duration, unit ) {

        // empty
        if ( !duration ) {
            return {};
        }

        // date
        else if ( duration instanceof Date ) {
            const milliseconds = duration - Date.now();

            return {
                milliseconds,
            };
        }

        // object
        else if ( typeof duration === "object" ) {
            return duration;
        }
        else {

            // number string
            const number = +duration;

            if ( !Number.isNaN( number ) ) {
                if ( !( unit in ALIASES ) ) throw new Error( `Duration unit is not valid` );

                if ( Number.isInteger( number ) ) {
                    return {
                        [ ALIASES[ unit ] ]: number,
                    };
                }
                else {
                    const milliseconds = number * UNITS[ unit ].milliseconds,
                        nanoseconds = Numeric( milliseconds ).decimal.multiply( 1_000_000 ).floor().number;

                    return {
                        milliseconds,
                        nanoseconds,
                    };
                }
            }

            // parse string
            duration = duration.trim();

            cache ??= new CacheLru( {
                "maxSize": 1000,
            } );

            let params = cache.get( duration );

            if ( !params ) {
                params = {};

                const match = duration.split( /\s*(-?\d+)\s*([A-Za-z]+)\s*/ );

                if ( match[ 0 ] !== "" || match.at( -1 ) !== "" ) throw new Error( `Duration format is not valid` );

                for ( let n = 1; n < match.length; n += 3 ) {
                    const unit = ALIASES[ match[ n + 1 ] ];

                    if ( !unit ) throw new Error( `Duration format is not valid` );

                    params[ unit ] ??= 0;
                    params[ unit ] += +match[ n ];
                }

                cache.set( duration, params );
            }

            return params;
        }
    }

    #toUnit ( unit ) {
        if ( this.#_toUnit[ unit ] == null ) {
            this.#_toUnit[ unit ] = 0;

            for ( const name in UNITS ) {
                if ( !this.#units[ name ] ) continue;

                this.#_toUnit[ unit ] += this.#units[ name ] * UNITS[ name ].milliseconds;

                if ( unit === name ) break;
            }

            this.#_toUnit[ unit ] = Math.trunc( this.#_toUnit[ unit ] / UNITS[ unit ].milliseconds );
        }

        return this.#_toUnit[ unit ];
    }

    #getNormalizedUnits () {
        if ( !this.#normalizedUnits ) {
            const units = { ...this.#units };

            // weeks -> months
            if ( Math.abs( units.weeks ) >= 4 ) {
                units.months += Math.trunc( units.weeks / 4 );
                units.weeks = units.weeks % 4;
            }

            // months -> years
            if ( Math.abs( units.months ) >= 12 ) {
                units.years += Math.trunc( units.months / 12 );
                units.months = units.months % 12;
            }

            this.#normalizedUnits = units;
        }

        return this.#normalizedUnits;
    }
}
