import CacheLru from "#lib/cache/lru";
import math from "#lib/math";
import Numeric from "#lib/numeric";

var cache;

const UNITS = {
        "years": {
            "singular": "year",
            "aliases": [ "yr", "yrs" ],
            "includes": [ 12, "months" ],
            "nanoseconds": 1_000_000n * 1000n * 60n * 60n * 24n * 365n, // 365 days
            "nginx": "y",
        },
        "months": {
            "singular": "month",
            "aliases": [ "mth", "mths" ],
            "includes": [ 30, "days" ],
            "normalize": [ 12, "years" ],
            "nanoseconds": ( 1_000_000n * 1000n * 60n * 60n * 24n * 365n ) / 12n, // 1 / 12 of year nanoseconds
            "nginx": "M",
        },
        "weeks": {
            "singular": "week",
            "aliases": [ "wk", "wks" ],
            "convert": [ 7, "days" ],
            "nanoseconds": 1_000_000n * 1000n * 60n * 60n * 24n * 7n,
            "nginx": "w",
        },
        "days": {
            "singular": "day",
            "aliases": [],
            "includes": [ 24, "hours" ],
            "nanoseconds": 1_000_000n * 1000n * 60n * 60n * 24n,
            "nginx": "d",
        },
        "hours": {
            "singular": "hour",
            "aliases": [ "hr", "hrs" ],
            "includes": [ 60, "minutes" ],
            "normalize": [ 24, "days" ],
            "nanoseconds": 1_000_000n * 1000n * 60n * 60n,
            "nginx": "h",
        },
        "minutes": {
            "singular": "minute",
            "aliases": [ "min", "mins" ],
            "includes": [ 60, "seconds" ],
            "normalize": [ 60, "hours" ],
            "nanoseconds": 1_000_000n * 1000n * 60n,
            "nginx": "m",
        },
        "seconds": {
            "singular": "second",
            "aliases": [ "sec", "secs" ],
            "includes": [ 1000, "milliseconds" ],
            "normalize": [ 60, "minutes" ],
            "nanoseconds": 1_000_000n * 1000n,
            "nginx": "s",
        },
        "milliseconds": {
            "singular": "millisecond",
            "aliases": [ "ms" ],
            "includes": [ 1000, "microseconds" ],
            "normalize": [ 1000, "seconds" ],
            "nanoseconds": 1_000_000n,
            "nginx": "ms",
        },
        "microseconds": {
            "singular": "microsecond",
            "aliases": [ "μs" ],
            "includes": [ 1000, "nanoseconds" ],
            "normalize": [ 1000, "milliseconds" ],
            "nanoseconds": 1000n,
            "nginx": null,
        },
        "nanoseconds": {
            "singular": "nanosecond",
            "aliases": [ "ns" ],
            "normalize": [ 1000, "microseconds" ],
            "nanoseconds": 1n,
            "nginx": null,
        },
    },
    DEFAULT_UNIT = "milliseconds",
    ALIASES = {};

// create aliases
for ( const name in UNITS ) {
    UNITS[ name ].name = name;

    ALIASES[ name ] = UNITS[ name ];
    ALIASES[ UNITS[ name ].singular ] = UNITS[ name ];

    for ( const alias of UNITS[ name ].aliases || [] ) {
        ALIASES[ alias ] = UNITS[ name ];
    }
}

export default class Interval {
    #units = {
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
    #string;
    #nginx;
    #formatRelativeDateParams;
    #formatDurationParams;
    #toUnit = {};
    #trunc = {};

    constructor ( duration, { unit = "milliseconds" } = {} ) {
        this.#parse( duration, unit );

        this.#normalizeUnits();
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

            for ( const [ name, value ] of Object.entries( this.#units ) ) {
                if ( !value ) continue;

                units.push( value + " " + ( Math.abs( value ) === 1
                    ? UNITS[ name ].singular
                    : name ) );
            }

            if ( units.length ) {
                this.#string = units.join( " " );
            }
            else {
                this.#string = "0 " + DEFAULT_UNIT;
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

            for ( const [ name, value ] of Object.entries( this.#units ) ) {
                if ( !value || !UNITS[ name ].nginx ) continue;

                units.push( value + UNITS[ name ].nginx );
            }

            this.#nginx = units.join( " " );
        }

        return this.#nginx;
    }

    toNanoseconds () {
        if ( this.#toUnit.nanoseconds == null ) {
            const units = { ...this.#units };

            // days -> months
            if ( Math.abs( units.days ) >= 30 ) {
                units.months += Math.trunc( units.days / 30 );
                units.days = units.days % 30;
            }

            // months -> years
            if ( Math.abs( units.months ) >= 12 ) {
                units.years += Math.trunc( units.months / 12 );
                units.months = units.months % 12;
            }

            this.#toUnit.nanoseconds = 0n;

            for ( const name in units ) {
                this.#toUnit.nanoseconds += BigInt( units[ name ] ) * UNITS[ name ].nanoseconds;
            }
        }

        return this.#toUnit.nanoseconds;
    }

    toMicroseconds () {
        this.#toUnit.microseconds ??= this.toNanoseconds() / 1000n;

        return this.#toUnit.microseconds;
    }

    toMilliseconds () {
        this.#toUnit.milliseconds ??= Number( this.toNanoseconds() / UNITS.milliseconds.nanoseconds );

        return this.#toUnit.milliseconds;
    }

    toSeconds () {
        this.#toUnit.seconds ??= Number( this.toNanoseconds() / UNITS.seconds.nanoseconds );

        return this.#toUnit.seconds;
    }

    toMinutes () {
        this.#toUnit.minutes ??= Number( this.toNanoseconds() / UNITS.minutes.nanoseconds );

        return this.#toUnit.minutes;
    }

    toHours () {
        this.#toUnit.hours ??= Number( this.toNanoseconds() / UNITS.hours.nanoseconds );

        return this.#toUnit.hours;
    }

    toDays () {
        this.#toUnit.days ??= Number( this.toNanoseconds() / UNITS.days.nanoseconds );

        return this.#toUnit.days;
    }

    toMonths () {
        this.#toUnit.months ??= Number( this.toNanoseconds() / UNITS.months.nanoseconds );

        return this.#toUnit.months;
    }

    toYears () {
        this.#toUnit.years ??= Number( this.toNanoseconds() / UNITS.years.nanoseconds );

        return this.#toUnit.years;
    }

    getFormatRelativeDateParams () {
        if ( !this.#formatRelativeDateParams ) {
            for ( const unit in this.#units ) {
                if ( math.abs( this.toNanoseconds() ) >= UNITS[ unit ].nanoseconds ) {
                    this.#formatRelativeDateParams = [ Number( this.toNanoseconds() / UNITS[ unit ].nanoseconds ), unit ];

                    break;
                }
            }

            // default
            this.#formatRelativeDateParams ||= [ 0, DEFAULT_UNIT ];
        }

        return this.#formatRelativeDateParams;
    }

    getFormatDurationParams () {
        if ( !this.#formatDurationParams ) {
            const units = { ...this.#units };

            // days -> months
            if ( Math.abs( units.days ) >= 30 ) {
                units.months += Math.trunc( units.days / 30 );
                units.days = units.days % 30;
            }

            // months -> years
            if ( Math.abs( units.months ) >= 12 ) {
                units.years += Math.trunc( units.months / 12 );
                units.months = units.months % 12;
            }

            this.#formatDurationParams = {};

            let found;

            for ( const [ name, value ] of Object.entries( units ) ) {
                if ( !value ) continue;

                found = true;

                this.#formatDurationParams[ name ] = value;
            }

            if ( !found ) this.#formatDurationParams[ DEFAULT_UNIT ] = 0;
        }

        return this.#formatDurationParams;
    }

    addDate ( date ) {
        date = new Date( date ?? Date.now() );

        if ( this.#units.years ) date.setFullYear( date.getFullYear() + this.#units.years );
        if ( this.#units.months ) date.setMonth( date.getMonth() + this.#units.months );
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

        for ( const unit in this.#units ) {
            units[ unit ] = this[ unit ] + interval[ unit ];
        }

        return new this.constructor( units );
    }

    subtractInterval ( interval ) {
        interval = this.constructor.new( interval );

        const units = {};

        for ( const unit in this.#units ) {
            units[ unit ] = this[ unit ] - interval[ unit ];
        }

        return new this.constructor( units );
    }

    trunc ( unit ) {
        unit = ALIASES[ unit ]?.name;
        if ( !unit ) throw new Error( "Interval unit is not valid" );

        var interval = this.#trunc[ unit ];

        if ( !interval ) {
            const units = {};

            for ( const name in this.#units ) {
                units[ name ] = this.#units[ name ];

                if ( name === unit ) break;
            }

            interval = new this.constructor( units );

            this.#trunc[ unit ] = interval;
        }

        return interval;
    }

    compare ( interval ) {
        interval = this.constructor.new( interval );

        return Number( this.toNanoseconds() - interval.toNanoseconds() );
    }

    // private
    #parse ( duration, unit ) {

        // empty
        if ( !duration ) {
            return;
        }

        // string
        else if ( typeof duration === "string" ) {
            duration = duration.replaceAll( " ", "" ).trim();

            cache ??= new CacheLru( {
                "maxSize": 1000,
            } );

            const units = cache.get( duration );

            if ( units ) {
                this.#units = { ...units };
            }
            else {
                const match = duration.split( /(-?\d+(?:\.\d+)?)([A-Za-z]+)/ );

                if ( match[ 0 ] !== "" || match.at( -1 ) !== "" ) throw new Error( `Duration format is not valid` );

                for ( let n = 1; n < match.length; n += 3 ) {
                    const unit = ALIASES[ match[ n + 1 ] ];
                    if ( !unit ) throw new Error( `Duration format is not valid` );

                    this.#addUnit( Number( match[ n ] ), unit.name );
                }

                cache.set( duration, { ...this.#units } );
            }
        }

        // number
        else if ( typeof duration === "number" ) {
            unit = ALIASES[ unit ];
            if ( !unit ) throw new Error( `Duration unit is not valid` );

            this.#addUnit( duration, unit.name );
        }

        // date
        else if ( duration instanceof Date ) {
            this.#addUnit( duration - Date.now(), "milliseconds" );
        }

        // object
        else if ( typeof duration === "object" ) {
            for ( const unit in this.#units ) {
                const value = duration[ unit ];

                if ( value ) {
                    this.#addUnit( value, unit );
                }
            }
        }

        // invalid
        else {
            throw new Error( "Interval is not valid" );
        }
    }

    #addUnit ( value, unit ) {
        if ( UNITS[ unit ].convert ) {
            value = value * UNITS[ unit ].convert[ 0 ];

            unit = UNITS[ unit ].convert[ 1 ];
        }

        if ( Number.isInteger( value ) ) {
            this.#units[ unit ] += value;
        }
        else {
            this.#parseFractionalUnit( value, unit );
        }
    }

    #parseFractionalUnit ( value, unit ) {
        value = Numeric( value );

        while ( true ) {
            this.#units[ unit ] += value.integer.number;

            if ( value.decimal.isZero ) break;

            const includes = UNITS[ unit ].includes;
            if ( !includes ) break;

            value = value.decimal.multiply( includes[ 0 ] );

            unit = includes[ 1 ];
        }
    }

    #normalizeUnits () {
        for ( const name of Object.keys( this.#units ).reverse() ) {
            const normalize = UNITS[ name ].normalize;

            if ( !normalize ) continue;

            if ( Math.abs( this.#units[ name ] ) >= normalize[ 0 ] ) {
                this.#units[ normalize[ 1 ] ] += Math.trunc( this.#units[ name ] / normalize[ 0 ] );

                this.#units[ name ] = this.#units[ name ] % normalize[ 0 ];
            }
        }
    }
}
