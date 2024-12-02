import CacheLru from "#lib/cache/lru";
import math from "#lib/math";
import Numeric from "#lib/numeric";

var cache;

const UNITS = {
        "years": {
            "singular": "year",
            "nanoseconds": 1_000_000n * 1000n * 60n * 60n * 24n * 365n,
            "months": 12,
            "nginx": "y",
            "duration": true,
        },
        "months": {
            "singular": "month",
            "nanoseconds": 1_000_000n * 1000n * 60n * 60n * 24n * 30n,
            "months": 1,
            "nginx": "M",
            "duration": true,
        },
        "weeks": {
            "singular": "week",
            "nanoseconds": 1_000_000n * 1000n * 60n * 60n * 24n * 7n,
            "months": null,
            "nginx": "w",
            "duration": true,
        },
        "days": {
            "singular": "day",
            "nanoseconds": 1_000_000n * 1000n * 60n * 60n * 24n,
            "months": null,
            "nginx": "d",
            "duration": true,
        },
        "hours": {
            "singular": "hour",
            "nanoseconds": 1_000_000n * 1000n * 60n * 60n,
            "months": null,
            "nginx": "h",
            "duration": true,
        },
        "minutes": {
            "singular": "minute",
            "nanoseconds": 1_000_000n * 1000n * 60n,
            "months": null,
            "nginx": "m",
            "duration": true,
        },
        "seconds": {
            "singular": "second",
            "nanoseconds": 1_000_000n * 1000n,
            "months": null,
            "nginx": "s",
            "duration": true,
        },
        "milliseconds": {
            "singular": "millisecond",
            "nanoseconds": 1_000_000n,
            "months": null,
            "nginx": "ms",
            "duration": false,
        },
        "microseconds": {
            "singular": "microsecond",
            "nanoseconds": 1000n,
            "months": null,
            "nginx": null,
            "duration": false,
        },
        "nanoseconds": {
            "singular": "nanosecond",
            "nanoseconds": 1n,
            "months": null,
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
    #nanoseconds;
    #months;
    #units;
    #string;
    #nginx;
    #formatRelativeDateParams;
    #formatDurationParams;
    #toUnit = {};

    constructor ( duration, { unit = "milliseconds" } = {} ) {
        const { nanoseconds, months } = this.#parse( duration, unit );

        this.#nanoseconds = nanoseconds || 0n;
        this.#months = months || 0;

        this.#units = this.#parseUnits();
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
        return Boolean( this.toNanoseconds() );
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

            this.#nginx = units.join( " " );
        }

        return this.#nginx;
    }

    toNanoseconds () {
        return ( this.#toUnit.nanoseconds ??= this.#nanoseconds + BigInt( this.#months * UNITS.months.nanoseconds ) );
    }

    toMicroseconds () {
        return ( this.#toUnit.microseconds ??= this.toNanoseconds() / 1000n );
    }

    toMilliseconds () {
        return ( this.#toUnit.milliseconds ??= Number( this.toNanoseconds() / UNITS.milliseconds.nanoseconds ) );
    }

    toSeconds () {
        return ( this.#toUnit.seconds ??= Number( this.toNanoseconds() / UNITS.seconds.nanoseconds ) );
    }

    toMinutes () {
        return ( this.#toUnit.minutes ??= Number( this.toNanoseconds() / UNITS.minutes.nanoseconds ) );
    }

    toHours () {
        return ( this.#toUnit.hours ??= Number( this.toNanoseconds() / UNITS.hours.nanoseconds ) );
    }

    toDays () {
        return ( this.#toUnit.days ??= Number( this.toNanoseconds() / UNITS.days.nanoseconds ) );
    }

    toWeeks () {
        return ( this.#toUnit.weeks ??= Number( this.toNanoseconds() / UNITS.weeks.nanoseconds ) );
    }

    toMonths () {
        return ( this.#toUnit.months ??= Number( this.toNanoseconds() / UNITS.months.nanoseconds ) );
    }

    toYears () {
        return ( this.#toUnit.years ??= Number( this.toNanoseconds() / UNITS.years.nanoseconds ) );
    }

    getFormatRelativeDateParams () {
        if ( !this.#formatRelativeDateParams ) {
            const units = this.#parseUnits( true );

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
            const units = this.#parseUnits( true );

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

        date.setMilliseconds( date.getMilliseconds() + Number( this.#nanoseconds / 1_000_000n ) );
        date.setMonth( date.getMonth() + this.#months );

        return date;
    }

    subtractDate ( date ) {
        date = new Date( date ?? Date.now() );

        date.setMilliseconds( date.getMilliseconds() - Number( this.#nanoseconds / 1_000_000n ) );
        date.setMonth( date.getMonth() - this.#months );

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

        return this.toNanoseconds() - interval.toNanoseconds();
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
                "nanoseconds": BigInt( milliseconds ) * 1_000_000n,
            };
        }

        // object
        else if ( typeof duration === "object" ) {
            const params = {};

            for ( const unit of Object.values( UNITS ) ) {
                if ( unit.months ) {
                    params.months ??= 0;
                    params.months += ( duration[ unit.name ] || 0 ) * unit.months;
                }
                else {
                    params.nanoseconds ??= 0n;
                    params.nanoseconds += BigInt( duration[ unit.name ] || 0 ) * unit.nanoseconds;
                }
            }

            return params;
        }

        // number
        else if ( typeof duration === "number" ) {
            unit = UNITS[ ALIASES[ unit ] ];
            if ( !unit ) throw new Error( `Duration unit is not valid` );

            // integer
            if ( Number.isInteger( duration ) ) {
                if ( unit.months ) {
                    return {
                        "months": duration * unit.months,
                    };
                }
                else {
                    return {
                        "nanoseconds": BigInt( duration ) * unit.nanoseconds,
                    };
                }
            }

            // float
            else {
                const nanoseconds = Numeric( duration ).miltiply( unit.nanoseconds ).trunc().bigint;

                return {
                    nanoseconds,
                };
            }
        }

        // bigint
        else if ( typeof duration === "bigint" ) {
            unit = UNITS[ ALIASES[ unit ] ];
            if ( !unit ) throw new Error( `Duration unit is not valid` );

            if ( unit.months ) {
                return {
                    "months": Number( duration ) * unit.months,
                };
            }
            else {
                return {
                    "nanoseconds": duration * unit.nanoseconds,
                };
            }
        }

        // string
        else {
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
                    const unit = UNITS[ ALIASES[ match[ n + 1 ] ] ];

                    if ( !unit ) throw new Error( `Duration format is not valid` );

                    if ( unit.months ) {
                        params.months ??= 0;
                        params.months += Number( match[ n ] ) * unit.months;
                    }
                    else {
                        params.nanoseconds ??= 0n;
                        params.nanoseconds += BigInt( match[ n ] ) * unit.nanoseconds;
                    }
                }

                cache.set( duration, params );
            }

            return params;
        }
    }

    // XXX
    #parseUnits ( weeksToMonths ) {
        var nanoseconds = this.#nanoseconds,
            months = this.#months;

        const units = {};

        // nanoseconds -> microseconds
        if ( nanoseconds ) {
            if ( math.abs( nanoseconds ) >= 1000n ) {
                units.microseconds = nanoseconds / 1000n;
                units.nanoseconds = Number( nanoseconds % 1000n );
            }
            else {
                units.nanoseconds = Number( nanoseconds );
            }
        }
        else {
            units.nanoseconds = 0;
        }

        // microseconds -> milliseconds
        if ( units.microseconds ) {
            if ( math.abs( units.microseconds ) >= 1000n ) {
                units.milliseconds = units.microseconds / 1000n;
                units.microseconds = Number( units.microseconds % 1000n );
            }
            else {
                units.microseconds = Number( units.microseconds );
            }
        }
        else {
            units.microseconds = 0;
        }

        // milliseconds -> seconds
        if ( units.milliseconds ) {
            if ( math.abs( units.milliseconds ) >= 1000n ) {
                units.seconds = units.milliseconds / 1000n;
                units.milliseconds = Number( units.milliseconds % 1000n );
            }
            else {
                units.milliseconds = Number( units.milliseconds );
            }
        }
        else {
            units.milliseconds = 0;
        }

        // seconds -> minutes
        if ( units.seconds ) {
            if ( math.abs( units.seconds ) >= 60n ) {
                units.minutes = units.seconds / 60n;
                units.seconds = Number( units.seconds % 60n );
            }
            else {
                units.seconds = Number( units.seconds );
            }
        }
        else {
            units.seconds = 0;
        }

        // minutes -> hours
        if ( units.minutes ) {
            if ( math.abs( units.minutes ) >= 60n ) {
                units.hours = units.minutes / 60n;
                units.minutes = Number( units.minutes % 60n );
            }
            else {
                units.minutes = Number( units.minutes );
            }
        }
        else {
            units.minutes = 0;
        }

        // hours -> days
        if ( units.hours ) {
            if ( math.abs( units.hours ) >= 24n ) {
                units.days = units.hours / 24n;
                units.hours = Number( units.hours % 24n );
            }
            else {
                units.hours = Number( units.hours );
            }
        }
        else {
            units.hours = 0;
        }

        // days -> weeks
        if ( units.days ) {
            if ( math.abs( units.days ) >= 7n ) {
                units.weeks = Number( units.days / 7n );
                units.days = Number( units.days % 7n );
            }
            else {
                units.days = Number( units.days );
                units.weeks = 0;
            }
        }
        else {
            units.days = 0;
            units.weeks = 0;
        }

        if ( weeksToMonths ) {

            // weeks -> months
            if ( units.weeks ) {
                if ( Math.abs( units.weeks ) >= 4 ) {
                    const weeks = BigInt( units.weeks );

                    months += weeks / 4n;
                    units.weeks = units.weeks % 4;
                }
            }
        }

        // months -> years
        if ( months ) {
            if ( math.abs( months ) >= 12n ) {
                units.months = Number( months % 12 );
                units.years = Number( months / 12n );
            }
            else {
                units.months = Number( months );
                units.years = 0;
            }
        }
        else {
            units.months = 0;
            units.years = 0;
        }

        return units;
    }
}
