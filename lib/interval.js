import CacheLru from "#lib/cache/lru";
import Numeric from "#lib/numeric";

var cache;

const UNITS = {
    "year": "year",
    "years": "year",

    "month": "month",
    "months": "month",

    "week": "week",
    "weeks": "week",

    "day": "day",
    "days": "day",

    "hour": "hour",
    "hours": "hour",

    "minute": "minute",
    "minutes": "minute",

    "second": "second",
    "seconds": "second",

    "millisecond": "millisecond",
    "milliseconds": "millisecond",

    "microsecond": "microsecond",
    "microseconds": "microsecond",

    "nanosecond": "nanosecond",
    "nanoseconds": "nanosecond",
};

const UNIT_ABBR = {
    "year": "year",
    "month": "month",
    "week": "week",
    "day": "day",
    "hour": "hour",
    "minute": "minute",
    "second": "second",
    "millisecond": "millisecond",
    "microsecond": "microsecond",
    "nanosecond": "nanosecond",
};

const NGINX_UNIT_ABBR = {
    "year": "y",
    "month": "M",
    "week": "w",
    "day": "d",
    "hour": "h",
    "minute": "m",
    "second": "s",
    "millisecond": "ms",
};

const UNIT_MILLISECONDS = {
    "year": 1000 * 60 * 60 * 24 * 365,
    "month": 1000 * 60 * 60 * 24 * 30,
    "week": 1000 * 60 * 60 * 24 * 7,
    "day": 1000 * 60 * 60 * 24,
    "hour": 1000 * 60 * 60,
    "minute": 1000 * 60,
    "second": 1000,
    "millisecond": 1,
    "microsecond": 1 / 1000,
    "nanosecond": 1 / 1_000_000,
};

const EMPTY_UNIT = "second";

const FORMAT_DURATION_UNITS = {
    "year": "years",
    "month": "months",
    "week": "weeks",
    "day": "days",
    "hour": "hours",
    "minute": "minutes",
    "second": "seconds",
    "millisecond": "milliseconds",
    "microsecond": "microseconds",
    "nanosecond": "nanoseconds",
};

export default class Interval {
    #negative;
    #units = {};
    #string;
    #nginx;
    #formatRelativeDateParams;
    #formatDurationParams;
    #_toUnit = {};

    constructor ( duration, { unit = "millisecond", negative } = {} ) {
        const { "negative": isNegative, year, month, week, day, hour, minute, second, millisecond, microsecond, nanosecond } = this.#parse( duration, unit, negative );

        if ( negative != null ) {
            this.#negative = !!negative;
        }
        else {
            this.#negative = !!isNegative;
        }

        this.#units.year = Math.floor( Math.abs( year || 0 ) );
        this.#units.month = Math.floor( Math.abs( month || 0 ) );
        this.#units.week = Math.floor( Math.abs( week || 0 ) );
        this.#units.day = Math.floor( Math.abs( day || 0 ) );
        this.#units.hour = Math.floor( Math.abs( hour || 0 ) );
        this.#units.minute = Math.floor( Math.abs( minute || 0 ) );
        this.#units.second = Math.floor( Math.abs( second || 0 ) );
        this.#units.millisecond = Math.floor( Math.abs( millisecond || 0 ) );
        this.#units.microsecond = Math.floor( Math.abs( microsecond || 0 ) );
        this.#units.nanosecond = Math.floor( Math.abs( nanosecond || 0 ) );

        // nanoseconds -> microseconds
        if ( this.#units.nanosecond >= 1000 ) {
            this.#units.microsecond += Math.floor( this.#units.nanosecond / 1000 );
            this.#units.nanosecond = this.#units.nanosecond % 1000;
        }

        // microseconds -> milliseconds
        if ( this.#units.microsecond >= 1000 ) {
            this.#units.millisecond += Math.floor( this.#units.microsecond / 1000 );
            this.#units.microsecond = this.#units.microsecond % 1000;
        }

        // milliseconds -> seconds
        if ( this.#units.millisecond >= 1000 ) {
            this.#units.second += Math.floor( this.#units.millisecond / 1000 );
            this.#units.millisecond = this.#units.millisecond % 1000;
        }

        // seconds -> minutes
        if ( this.#units.second >= 60 ) {
            this.#units.minute += Math.floor( this.#units.second / 60 );
            this.#units.second = this.#units.second % 60;
        }

        // minutes -> hours
        if ( this.#units.minute >= 60 ) {
            this.#units.hour += Math.floor( this.#units.minute / 60 );
            this.#units.minute = this.#units.minute % 60;
        }

        // hours -> days
        if ( this.#units.hour >= 24 ) {
            this.#units.day += Math.floor( this.#units.hour / 24 );
            this.#units.hour = this.#units.hour % 24;
        }

        // days -> weeks
        if ( this.#units.day >= 7 ) {
            this.#units.week += Math.floor( this.#units.day / 7 );
            this.#units.day = this.#units.day % 7;
        }

        // months -> years
        if ( this.#units.month >= 12 ) {
            this.#units.year += Math.floor( this.#units.month / 12 );
            this.#units.month = this.#units.month % 12;
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
        return this.toMilliseconds() || this.#units.microsecond || this.#units.nanosecond;
    }

    get isNegative () {
        return this.#negative;
    }

    get year () {
        return this.#units.year;
    }

    get month () {
        return this.#units.month;
    }

    get week () {
        return this.#units.week;
    }

    get day () {
        return this.#units.day;
    }

    get hour () {
        return this.#units.hour;
    }

    get minute () {
        return this.#units.minute;
    }

    get second () {
        return this.#units.second;
    }

    get millisecond () {
        return this.#units.millisecond;
    }

    get microsecond () {
        return this.#units.microsecond;
    }

    get nanosecond () {
        return this.#units.nanosecond;
    }

    // public
    toString () {
        if ( this.#string == null ) {
            const units = [];

            for ( const [ unit, abbr ] of Object.entries( UNIT_ABBR ) ) {
                const value = this.#units[ unit ];

                if ( !value ) continue;

                units.push( value + " " + ( value === 1
                    ? abbr
                    : abbr + "s" ) );
            }

            if ( units.length ) {
                this.#string = ( this.#negative
                    ? "-"
                    : "" ) + units.join( " " );
            }
            else {
                this.#string = "0 " + UNIT_ABBR[ EMPTY_UNIT ];
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

            for ( const [ unit, abbr ] of Object.entries( NGINX_UNIT_ABBR ) ) {
                if ( !this.#units[ unit ] ) continue;

                units.push( this.#units[ unit ] + abbr );
            }

            this.#nginx = units.join( "" );
        }

        return this.#nginx;
    }

    toMilliseconds ( { sign } = {} ) {
        return this.#toUnit( "millisecond", sign );
    }

    toSeconds ( { sign } = {} ) {
        return this.#toUnit( "second", sign );
    }

    toMinutes ( { sign } = {} ) {
        return this.#toUnit( "minute", sign );
    }

    toHours ( { sign } = {} ) {
        return this.#toUnit( "hour", sign );
    }

    toDays ( { sign } = {} ) {
        return this.#toUnit( "day", sign );
    }

    toWeeks ( { sign } = {} ) {
        return this.#toUnit( "week", sign );
    }

    toMonths ( { sign } = {} ) {
        return this.#toUnit( "month", sign );
    }

    toYears ( { sign } = {} ) {
        return this.#toUnit( "year", sign );
    }

    getFormatRelativeDateParams () {
        if ( !this.#formatRelativeDateParams ) {
            const units = { ...this.#units };

            // weeks -> months
            if ( units.week >= 4 ) {
                units.month += Math.floor( units.week / 4 );
                units.week = units.week % 4;
            }

            // months -> years
            if ( units.month >= 12 ) {
                units.year += Math.floor( units.month / 12 );
                units.month = units.month % 12;
            }

            for ( const unit of [ "year", "month", "week", "day", "hour", "minute", "second" ] ) {
                if ( !units[ unit ] ) continue;

                this.#formatRelativeDateParams = [ this.#negative
                    ? 0 - units[ unit ]
                    : units[ unit ], unit ];

                break;
            }

            // default
            this.#formatRelativeDateParams ||= [ 0, "second" ];
        }

        return this.#formatRelativeDateParams;
    }

    getFormatDurationParams () {
        if ( !this.#formatDurationParams ) {
            const units = { ...this.#units };

            // weeks -> months
            if ( units.week >= 4 ) {
                units.month += Math.floor( units.week / 4 );
                units.week = units.week % 4;
            }

            // months -> years
            if ( units.month >= 12 ) {
                units.year += Math.floor( units.month / 12 );
                units.month = units.month % 12;
            }

            this.#formatDurationParams = {};

            let found;

            for ( const [ unit, value ] of Object.entries( units ) ) {
                if ( !value ) continue;

                found = true;

                this.#formatDurationParams[ FORMAT_DURATION_UNITS[ unit ] ] = value;
            }

            if ( !found ) this.#formatDurationParams[ EMPTY_UNIT ] = 0;
        }

        return this.#formatDurationParams;
    }

    addDate ( date ) {
        if ( this.#negative ) {
            return this.#subtractDate( date );
        }
        else {
            return this.#addDate( date );
        }
    }

    subtractDate ( date ) {
        if ( this.#negative ) {
            return this.#addDate( date );
        }
        else {
            return this.#subtractDate( date );
        }
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
            const millisecond = duration - Date.now();

            return {
                "negative": millisecond < 0,
                millisecond,
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
                if ( !( unit in UNITS ) ) throw new Error( `Duration unit is not valid` );

                if ( Number.isInteger( number ) ) {
                    return {
                        "negative": number < 0,
                        [ UNITS[ unit ] ]: number,
                    };
                }
                else {
                    const millisecond = Math.abs( number ) * UNIT_MILLISECONDS[ UNITS[ unit ] ],
                        nanosecond = Numeric( millisecond ).decimal.multiply( 1_000_000 ).floor().number;

                    return {
                        "negative": number < 0,
                        millisecond,
                        nanosecond,
                    };
                }
            }

            // parse string
            duration = duration.trim();

            cache ??= new CacheLru( { "maxSize": 1000 } );

            let params = cache.get( duration );

            if ( !params ) {
                params = {};

                if ( duration.startsWith( "-" ) ) {
                    params.negative = true;

                    duration = duration.slice( 1 );
                }

                const match = duration.split( /\s*(\d+)\s*([A-Za-z]+)\s*/ );

                if ( match[ 0 ] !== "" || match.at( -1 ) !== "" ) throw new Error( `Duration format is not valid` );

                for ( let n = 1; n < match.length; n += 3 ) {
                    const unit = UNITS[ match[ n + 1 ] ];

                    if ( !unit || unit in params ) throw new Error( `Duration format is not valid` );

                    params[ unit ] = +match[ n ];
                }

                cache.set( duration, params );
            }

            return params;
        }
    }

    #toUnit ( unit, sign = true ) {
        if ( this.#_toUnit[ unit ] == null ) {
            this.#_toUnit[ unit ] = 0;

            for ( const unit1 in UNIT_MILLISECONDS ) {
                if ( !this.#units[ unit1 ] ) continue;

                this.#_toUnit[ unit ] += this.#units[ unit1 ] * UNIT_MILLISECONDS[ unit1 ];

                if ( unit === unit1 ) break;
            }

            this.#_toUnit[ unit ] = Math.floor( this.#_toUnit[ unit ] / UNIT_MILLISECONDS[ unit ] );
        }

        if ( sign && this.#negative ) {
            return 0 - this.#_toUnit[ unit ];
        }
        else {
            return this.#_toUnit[ unit ];
        }
    }

    #addDate ( date ) {
        date = new Date( date ?? Date.now() );

        if ( this.#units.year ) date.setFullYear( date.getFullYear() + this.#units.year );
        if ( this.#units.month ) date.setMonth( date.getMonth() + this.#units.month );
        if ( this.#units.week ) date.setDate( date.getDate() + this.#units.week * 7 );
        if ( this.#units.day ) date.setDate( date.getDate() + this.#units.day );
        if ( this.#units.hour ) date.setHours( date.getHours() + this.#units.hour );
        if ( this.#units.minute ) date.setMinutes( date.getMinutes() + this.#units.minute );
        if ( this.#units.second ) date.setSeconds( date.getSeconds() + this.#units.second );
        if ( this.#units.millisecond ) date.setMilliseconds( date.getMilliseconds() + this.#units.millisecond );

        return date;
    }

    #subtractDate ( date ) {
        date = new Date( date ?? Date.now() );

        if ( this.#units.year ) date.setFullYear( date.getFullYear() - this.#units.year );
        if ( this.#units.month ) date.setMonth( date.getMonth() - this.#units.month );
        if ( this.#units.week ) date.setDate( date.getDate() - this.#units.week * 7 );
        if ( this.#units.day ) date.setDate( date.getDate() - this.#units.day );
        if ( this.#units.hour ) date.setHours( date.getHours() - this.#units.hour );
        if ( this.#units.minute ) date.setMinutes( date.getMinutes() - this.#units.minute );
        if ( this.#units.second ) date.setSeconds( date.getSeconds() - this.#units.second );
        if ( this.#units.millisecond ) date.setMilliseconds( date.getMilliseconds() - this.#units.millisecond );

        return date;
    }
}
