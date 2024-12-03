import CacheLru from "#lib/cache/lru";
import math from "#lib/math";
import Numeric from "#lib/numeric";

var cache;

const UNITS = {
        "years": {
            "singular": "year",
            "nanoseconds": 1_000_000n * 1000n * 60n * 60n * 24n * 365n, // 365 days
            "months": 12,
            "nginx": "y",
            "duration": true,
        },
        "months": {
            "singular": "month",
            "nanoseconds": ( 1_000_000n * 1000n * 60n * 60n * 24n * 365n ) / 12n, // 1 / 12 of year nanoseconds
            "months": 1,
            "nginx": "M",
            "duration": true,
        },
        "weeks": {
            "singular": "week",
            "nanoseconds": 1_000_000n * 1000n * 60n * 60n * 24n * 7n,
            "months": null,
            "nginx": "w",
            "skip": true,
            "duration": false,
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

    ALIASES[ name ] = UNITS[ name ];
    ALIASES[ UNITS[ name ].singular ] = UNITS[ name ];
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

        this.#nanoseconds = nanoseconds;
        this.#months = months;

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
        return ( this.#toUnit.nanoseconds ??= this.#nanoseconds + BigInt( this.#months ) * UNITS.months.nanoseconds );
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
            for ( const unit of Object.values( UNITS ) ) {
                if ( unit.skip ) continue;

                if ( math.abs( this.toNanoseconds() ) >= unit.nanoseconds ) {
                    this.#formatRelativeDateParams = [ Number( this.toNanoseconds() / unit.nanoseconds ), unit.name ];

                    break;
                }
            }

            // default
            this.#formatRelativeDateParams ||= [ 0, EMPTY_UNIT ];
        }

        return this.#formatRelativeDateParams;
    }

    getFormatDurationParams () {
        if ( !this.#formatDurationParams ) {
            const units = this.#parseUnits( {
                "daysToMonths": true,
            } );

            this.#formatDurationParams = {};

            let found;

            for ( const [ name, value ] of Object.entries( units ) ) {
                if ( !value ) continue;

                const unit = UNITS[ name ];

                if ( unit.skip || !unit.duration ) continue;

                found = true;

                this.#formatDurationParams[ name ] = value;
            }

            if ( !found ) this.#formatDurationParams[ EMPTY_UNIT ] = 0;
        }

        return this.#formatDurationParams;
    }

    addDate ( date ) {
        date = new Date( date ?? Date.now() );

        if ( this.#nanoseconds ) {
            date.setMilliseconds( date.getMilliseconds() + Number( this.#nanoseconds / 1_000_000n ) );
        }

        if ( this.#months ) {
            date.setMonth( date.getMonth() + this.#months );
        }

        return date;
    }

    subtractDate ( date ) {
        date = new Date( date ?? Date.now() );

        if ( this.#nanoseconds ) {
            date.setMilliseconds( date.getMilliseconds() - Number( this.#nanoseconds / 1_000_000n ) );
        }

        if ( this.#months ) {
            date.setMonth( date.getMonth() - this.#months );
        }

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

        return Number( this.toNanoseconds() - interval.toNanoseconds() );
    }

    // private
    #parse ( duration, unit ) {
        const params = {
            "nanoseconds": 0n,
            "months": 0,
        };

        // empty
        if ( !duration ) {
            return params;
        }

        // date
        else if ( duration instanceof Date ) {
            const milliseconds = duration - Date.now();

            params.nanoseconds = BigInt( milliseconds ) * 1_000_000n;

            return params;
        }

        // object
        else if ( typeof duration === "object" ) {
            for ( const unit of Object.values( UNITS ) ) {
                if ( unit.months ) {
                    params.months += ( duration[ unit.name ] || 0 ) * unit.months;
                }
                else {
                    params.nanoseconds += BigInt( duration[ unit.name ] || 0 ) * unit.nanoseconds;
                }
            }

            return params;
        }

        // number
        else if ( typeof duration === "number" ) {
            unit = ALIASES[ unit ];
            if ( !unit ) throw new Error( `Duration unit is not valid` );

            // integer
            if ( Number.isInteger( duration ) ) {
                if ( unit.months ) {
                    params.months = duration * unit.months;
                }
                else {
                    params.nanoseconds = BigInt( duration ) * unit.nanoseconds;
                }

                return params;
            }

            // float
            else {
                if ( unit.months ) {
                    params.nanoseconds = Numeric( duration ).decimal.multiply( unit.nanoseconds ).trunc().bigint;

                    params.months = Math.trunc( duration ) * unit.months;
                }
                else {
                    params.nanoseconds = Numeric( duration ).multiply( unit.nanoseconds ).trunc().bigint;
                }

                return params;
            }
        }

        // bigint
        else if ( typeof duration === "bigint" ) {
            unit = ALIASES[ unit ];
            if ( !unit ) throw new Error( `Duration unit is not valid` );

            if ( unit.months ) {
                params.months = Number( duration ) * unit.months;
            }
            else {
                params.nanoseconds = duration * unit.nanoseconds;
            }

            return params;
        }

        // string
        else {
            duration = duration.trim();

            cache ??= new CacheLru( {
                "maxSize": 1000,
            } );

            let params = cache.get( duration );

            if ( !params ) {
                params = {
                    "nanoseconds": 0n,
                    "months": 0,
                };
            }
            {
                const match = duration.split( /\s*(-?\d+)\s*([A-Za-z]+)\s*/ );

                if ( match[ 0 ] !== "" || match.at( -1 ) !== "" ) throw new Error( `Duration format is not valid` );

                for ( let n = 1; n < match.length; n += 3 ) {
                    const unit = ALIASES[ match[ n + 1 ] ];
                    if ( !unit ) throw new Error( `Duration format is not valid` );

                    if ( unit.months ) {
                        params.months += Number( match[ n ] ) * unit.months;
                    }
                    else {
                        params.nanoseconds += BigInt( match[ n ] ) * unit.nanoseconds;
                    }
                }

                cache.set( duration, params );
            }

            return params;
        }
    }

    #parseUnits ( { daysToMonths } = {} ) {
        const units = {
            "years": 0,
            "months": 0,
            "days": 0,
            "hours": 0,
            "minutes": 0,
            "seconds": 0,
            "milliseconds": 0,
            "microseconds": 0,
            "nanoseconds": 0,
        };

        var nanoseconds = this.#nanoseconds,
            months = this.#months;

        if ( daysToMonths ) {
            nanoseconds += BigInt( months ) * UNITS.months.nanoseconds;
        }
        else {

            // months -> years
            if ( months ) {
                if ( Math.abs( months ) >= 12 ) {
                    units.months = months % 12;
                    units.years = Math.trunc( months / 12 );
                }
                else {
                    units.months = months;
                }
            }
        }

        for ( const unit of Object.values( UNITS ) ) {
            if ( unit.skip ) continue;

            if ( !daysToMonths && unit.months ) {
                continue;
            }

            if ( math.abs( nanoseconds >= unit.nanoseconds ) ) {
                units[ unit.name ] = Number( nanoseconds / unit.nanoseconds );

                nanoseconds = nanoseconds % unit.nanoseconds;
            }
        }

        return units;
    }
}
