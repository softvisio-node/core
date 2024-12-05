import CacheLru from "#lib/cache/lru";
import Numeric from "#lib/numeric";

var cache;

const UNITS = {
        "years": {
            "long": [ "year", "years" ],
            "short": [ "yr", "yrs" ],
            "narrow": [ "y", "y" ],
            "contains": [ 12, "months" ],
            "nanoseconds": 1_000_000n * 1000n * 60n * 60n * 24n * 365n, // 365 days
            "months": 12,
            "nginx": "y",
            "relativeDateParam": true,
        },
        "quarters": {
            "long": [ "quarter", "quarters" ],
            "short": [ "qtr", "qtrs" ],
            "narrow": [ "q", "q" ],
            "contains": [ 3, "months" ],
            "nanoseconds": ( 1_000_000n * 1000n * 60n * 60n * 24n * 365n ) / 4n, // 1 / 4 year
            "months": 3,
            "nginx": null,
            "relativeDateParam": true,
        },
        "months": {
            "long": [ "month", "months" ],
            "short": [ "mth", "mths" ],
            "narrow": [ "mo", "mo" ],
            "aliases": [ "M" ],
            "contains": [ 30, "days" ],
            "nanoseconds": ( 1_000_000n * 1000n * 60n * 60n * 24n * 365n ) / 12n, // 1 / 12 year
            "months": 1,
            "nginx": "M",
            "relativeDateParam": true,
        },
        "weeks": {
            "long": [ "week", "weeks" ],
            "short": [ "wk", "wks" ],
            "narrow": [ "w", "w" ],
            "contains": [ 7, "days" ],
            "nanoseconds": 1_000_000n * 1000n * 60n * 60n * 24n * 7n, // 7 days
            "nginx": "w",
            "relativeDateParam": true,
        },
        "days": {
            "long": [ "day", "days" ],
            "short": [ "day", "days" ],
            "narrow": [ "d", "d" ],
            "contains": [ 24, "hours" ],
            "nanoseconds": 1_000_000n * 1000n * 60n * 60n * 24n,
            "nginx": "d",
            "relativeDateParam": true,
        },
        "hours": {
            "long": [ "hour", "hours" ],
            "short": [ "hr", "hrs" ],
            "narrow": [ "h", "h" ],
            "contains": [ 60, "minutes" ],
            "nanoseconds": 1_000_000n * 1000n * 60n * 60n,
            "nginx": "h",
            "relativeDateParam": true,
        },
        "minutes": {
            "long": [ "minute", "minutes" ],
            "short": [ "min", "mins" ],
            "narrow": [ "m", "m" ],
            "contains": [ 60, "seconds" ],
            "nanoseconds": 1_000_000n * 1000n * 60n,
            "nginx": "m",
            "relativeDateParam": true,
        },
        "seconds": {
            "long": [ "second", "seconds" ],
            "short": [ "sec", "secs" ],
            "narrow": [ "s", "s" ],
            "contains": [ 1000, "milliseconds" ],
            "nanoseconds": 1_000_000n * 1000n,
            "nginx": "s",
            "relativeDateParam": true,
        },
        "milliseconds": {
            "long": [ "millisecond", "milliseconds" ],
            "short": [ "ms", "ms" ],
            "narrow": [ "ms", "ms" ],
            "contains": [ 1000, "microseconds" ],
            "nanoseconds": 1_000_000n,
            "nginx": "ms",
            "relativeDateParam": false,
        },
        "microseconds": {
            "long": [ "microsecond", "microseconds" ],
            "short": [ "μs", "μs" ],
            "narrow": [ "μs", "μs" ],
            "contains": [ 1000, "nanoseconds" ],
            "nanoseconds": 1000n,
            "nginx": null,
            "relativeDateParam": false,
        },
        "nanoseconds": {
            "long": [ "nanosecond", "nanoseconds" ],
            "short": [ "ns", "ns" ],
            "narrow": [ "ns", "ns" ],
            "nanoseconds": 1n,
            "nginx": null,
            "relativeDateParam": false,
        },
    },
    DEFAULT_UNIT = "milliseconds",
    ALIASES = {},
    STYLES = {
        "long": " ",
        "short": " ",
        "narrow": "",
    },
    DAYS_IN_MONTH = Numeric( 365 ).divide( 12 );

// create aliases
for ( const name in UNITS ) {
    UNITS[ name ].name = name;

    ALIASES[ name ] = UNITS[ name ];

    for ( const alias of UNITS[ name ].long || [] ) {
        ALIASES[ alias ] = UNITS[ name ];
    }

    for ( const alias of UNITS[ name ].short || [] ) {
        ALIASES[ alias ] = UNITS[ name ];
    }

    for ( const alias of UNITS[ name ].narrow || [] ) {
        ALIASES[ alias ] = UNITS[ name ];
    }

    for ( const alias of UNITS[ name ].aliases || [] ) {
        ALIASES[ alias ] = UNITS[ name ];
    }
}

function compareDates ( date1, date2 ) {
    date1 = new Date( date1 );
    date2 = new Date( date2 );

    const units = {
        "years": date2.getFullYear() - date1.getFullYear(),
        "months": date2.getMonth() - date1.getMonth(),
        "days": date2.getDate() - date1.getDate(),
        "hours": date2.getHours() - date1.getHours(),
        "minutes": date2.getMinutes() - date1.getMinutes(),
        "seconds": date2.getSeconds() - date1.getSeconds(),
        "milliseconds": date2.getMilliseconds() - date1.getMilliseconds(),
    };

    return units;
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
        "nanoseconds": 0n,
    };
    #strings = {};
    #toUnits = {};
    #trunc = {};
    #formatDurationParams;
    #formatRelativeDateParams;
    #normalizedDaysUnits;

    constructor ( interval, unit ) {
        unit ||= "milliseconds";

        this.#parse( interval, unit );

        this.#normalizeUnits();
    }

    // static
    static new ( interval, unit ) {
        if ( interval instanceof this ) return interval;

        return new this( interval, unit );
    }

    static fromDates ( date1, date2 ) {
        return new this( compareDates( date1, date2 ) );
    }

    static get compare () {
        return ( a, b ) => this.new( a ).compare( b );
    }

    // properties
    get hasValue () {
        return this.toNanoseconds().isZero;
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
    toString ( style = "long" ) {
        if ( STYLES[ style ] == null ) {
            style = "long";
        }

        if ( this.#strings[ style ] == null ) {
            const units = [];

            for ( const [ name, value ] of Object.entries( this.#units ) ) {
                if ( !value ) continue;

                units.push( value + STYLES[ style ] + ( Math.abs( value ) === 1
                    ? UNITS[ name ][ style ][ 0 ]
                    : UNITS[ name ][ style ][ 1 ] ) );
            }

            if ( units.length ) {
                this.#strings[ style ] = units.join( " " );
            }
            else {
                this.#strings[ style ] = "0 " + DEFAULT_UNIT;
            }
        }

        return this.#strings[ style ];
    }

    toJSON () {
        return this.toString();
    }

    toNginx () {
        if ( this.#strings.nginx == null ) {
            const units = [];

            for ( const [ name, value ] of Object.entries( this.#units ) ) {
                if ( !value || !UNITS[ name ].nginx ) continue;

                units.push( value + UNITS[ name ].nginx );
            }

            this.#strings.nginx = units.join( " " );
        }

        return this.#strings.nginx;
    }

    toNanoseconds () {
        if ( this.#toUnits.nanoseconds == null ) {
            this.#toUnits.nanoseconds = Numeric( 0 );

            for ( const name in this.#units ) {
                this.#toUnits.nanoseconds = this.#toUnits.nanoseconds.add( UNITS[ name ].nanoseconds * BigInt( this.#units[ name ] ) );
            }
        }

        return this.#toUnits.nanoseconds;
    }

    toMicroseconds ( scale ) {
        return this.#toUnit( "microseconds", scale );
    }

    toMilliseconds ( scale ) {
        return this.#toUnit( "milliseconds", scale );
    }

    toSeconds ( scale ) {
        return this.#toUnit( "seconds", scale );
    }

    toMinutes ( scale ) {
        return this.#toUnit( "minutes", scale );
    }

    toHours ( scale ) {
        return this.#toUnit( "hours", scale );
    }

    toDays ( scale ) {
        return this.#toUnit( "days", scale );
    }

    toWeeks ( scale ) {
        return this.#toUnit( "weeks", scale );
    }

    toMonths ( scale ) {
        return this.#toUnit( "months", scale );
    }

    toQuarters ( scale ) {
        return this.#toUnit( "quarters", scale );
    }

    toYears ( scale ) {
        return this.#toUnit( "years", scale );
    }

    getFormatDurationParams () {
        if ( !this.#formatDurationParams ) {
            const units = this.#getNormalizedDaysUnits();

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

    getFormatRelativeDateParams () {
        if ( !this.#formatRelativeDateParams ) {
            const units = this.#getNormalizedDaysUnits();

            for ( const unit in units ) {
                if ( !UNITS[ unit ].relativeDateParam ) continue;

                if ( units[ unit ] ) {
                    this.#formatRelativeDateParams = [ units[ unit ], unit ];

                    break;
                }
            }

            // default
            this.#formatRelativeDateParams ||= [ 0, "seconds" ];
        }

        return this.#formatRelativeDateParams;
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

        return this.toNanoseconds().compare( interval.toNanoseconds() );
    }

    // private
    #parse ( interval, unit ) {

        // empty
        if ( !interval ) {
            return;
        }

        // string
        else if ( typeof interval === "string" ) {
            interval = interval.replaceAll( " ", "" ).trim();

            cache ??= new CacheLru( {
                "maxSize": 1000,
            } );

            const units = cache.get( interval );

            if ( units ) {
                this.#units = { ...units };
            }
            else {
                const match = interval.split( /([+-]?\d+(?:\.\d+)?)([A-Za-z]+)/ );

                if ( match[ 0 ] !== "" || match.at( -1 ) !== "" ) throw new Error( `Duration format is not valid` );

                for ( let n = 1; n < match.length; n += 3 ) {
                    const unit = ALIASES[ match[ n + 1 ] ];
                    if ( !unit ) throw new Error( `Duration format is not valid` );

                    this.#addUnit( Number( match[ n ] ), unit.name );
                }

                cache.set( interval, { ...this.#units } );
            }
        }

        // number
        else if ( typeof interval === "number" ) {
            unit = ALIASES[ unit ];
            if ( !unit ) throw new Error( `Duration unit is not valid` );

            this.#addUnit( interval, unit.name );
        }

        // date
        else if ( interval instanceof Date ) {
            const units = compareDates( Date.now(), interval );

            for ( const unit in this.#units ) {
                this.#addUnit( units[ unit ], unit );
            }
        }

        // object
        else if ( typeof interval === "object" ) {
            for ( const unit in this.#units ) {
                this.#addUnit( interval[ unit ], unit );
            }
        }

        // invalid
        else {
            throw new Error( "Interval is not valid" );
        }
    }

    #addUnit ( value, unit ) {
        if ( !value ) return;

        // integer
        if ( Number.isInteger( value ) ) {
            if ( UNITS[ unit ].months ) {
                this.#units.months += value * UNITS[ unit ].months;
            }
            else {
                this.#units.nanoseconds += UNITS[ unit ].nanoseconds * BigInt( value );
            }
        }

        // fractional
        else {
            this.#addFractionalUnit( value, unit );
        }
    }

    // XXX - do not use contains
    #addFractionalUnit ( value, unit ) {
        value = Numeric( value );

        while ( true ) {
            this.#addUnit( value.integer.number, unit );

            if ( value.decimal.isZero ) break;

            const contains = UNITS[ unit ].contains;
            if ( !contains ) break;

            value = value.decimal.multiply( contains[ 0 ] );

            unit = contains[ 1 ];
        }
    }

    #normalizeUnits () {
        for ( const name of Object.keys( this.#units ) ) {

            // months
            if ( UNITS[ name ].months ) {
                if ( name !== "months" ) {
                    this.#units[ name ] = Math.trunc( this.#units.months / UNITS[ name ].months );
                    this.#units.months = this.#units.months % UNITS[ name ].months;
                }
            }

            // nanoseconds
            else {
                if ( name === "nanoseconds" ) {
                    this.#units[ name ] = Number( this.#units.nanoseconds );
                }
                else {
                    this.#units[ name ] = Number( this.#units.nanoseconds / UNITS[ name ].nanoseconds );
                    this.#units.nanoseconds = this.#units.nanoseconds % UNITS[ name ].nanoseconds;
                }
            }
        }
    }

    // XXX trunc / round
    #getNormalizedDaysUnits () {
        if ( !this.#normalizedDaysUnits ) {
            this.#normalizedDaysUnits = { ...this.#units };

            // days -> years
            if ( Math.abs( this.#normalizedDaysUnits.days ) >= 365 ) {
                this.#normalizedDaysUnits.years += Math.trunc( this.#normalizedDaysUnits.days / 365 );
                this.#normalizedDaysUnits.days = this.#normalizedDaysUnits.days % 365;
            }

            // days -> months
            if ( Math.abs( this.#normalizedDaysUnits.days ) >= DAYS_IN_MONTH.number ) {
                const months = Numeric( this.#normalizedDaysUnits.days ).divide( DAYS_IN_MONTH );

                this.#normalizedDaysUnits.months += months.trunc().number;
                this.#normalizedDaysUnits.days = months.decimal.multiply( DAYS_IN_MONTH ).trunc().number;

                // months -> years
                if ( Math.abs( this.#normalizedDaysUnits.months ) >= 12 ) {
                    this.#normalizedDaysUnits.years += Math.trunc( this.#normalizedDaysUnits.months / 12 );
                    this.#normalizedDaysUnits.months = this.#normalizedDaysUnits.months % 12;
                }
            }
        }

        return this.#normalizedDaysUnits;
    }

    #toUnit ( unit, scale ) {
        const id = unit + "/" + ( scale || 0 );

        this.#toUnits[ id ] ??= this.toNanoseconds().divide( UNITS[ unit ].nanoseconds ).round( scale ).number;

        return this.#toUnits[ id ];
    }
}
