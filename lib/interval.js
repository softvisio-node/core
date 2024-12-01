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
    #units = {};
    #string;
    #nginx;
    #formatRelativeDateParams;
    #formatDurationParams;
    #_toUnit = {};

    constructor ( duration, { unit = "millisecond" } = {} ) {
        const { year, month, week, day, hour, minute, second, millisecond, microsecond, nanosecond } = this.#parse( duration, unit );

        this.#units.year = Math.trunc( year || 0 );
        this.#units.month = Math.trunc( month || 0 );
        this.#units.week = Math.trunc( week || 0 );
        this.#units.day = Math.trunc( day || 0 );
        this.#units.hour = Math.trunc( hour || 0 );
        this.#units.minute = Math.trunc( minute || 0 );
        this.#units.second = Math.trunc( second || 0 );
        this.#units.millisecond = Math.trunc( millisecond || 0 );
        this.#units.microsecond = Math.trunc( microsecond || 0 );
        this.#units.nanosecond = Math.trunc( nanosecond || 0 );

        // nanoseconds -> microseconds
        if ( Math.abs( this.#units.nanosecond ) >= 1000 ) {
            this.#units.microsecond += Math.trunc( this.#units.nanosecond / 1000 );
            this.#units.nanosecond = this.#units.nanosecond % 1000;
        }

        // microseconds -> milliseconds
        if ( Math.abs( this.#units.microsecond ) >= 1000 ) {
            this.#units.millisecond += Math.trunc( this.#units.microsecond / 1000 );
            this.#units.microsecond = this.#units.microsecond % 1000;
        }

        // milliseconds -> seconds
        if ( Math.abs( this.#units.millisecond ) >= 1000 ) {
            this.#units.second += Math.trunc( this.#units.millisecond / 1000 );
            this.#units.millisecond = this.#units.millisecond % 1000;
        }

        // seconds -> minutes
        if ( Math.abs( this.#units.second ) >= 60 ) {
            this.#units.minute += Math.trunc( this.#units.second / 60 );
            this.#units.second = this.#units.second % 60;
        }

        // minutes -> hours
        if ( Math.abs( this.#units.minute ) >= 60 ) {
            this.#units.hour += Math.trunc( this.#units.minute / 60 );
            this.#units.minute = this.#units.minute % 60;
        }

        // hours -> days
        if ( Math.abs( this.#units.hour ) >= 24 ) {
            this.#units.day += Math.trunc( this.#units.hour / 24 );
            this.#units.hour = this.#units.hour % 24;
        }

        // days -> weeks
        if ( Math.abs( this.#units.day ) >= 7 ) {
            this.#units.week += Math.trunc( this.#units.day / 7 );
            this.#units.day = this.#units.day % 7;
        }

        // months -> years
        if ( Math.abs( this.#units.month ) >= 12 ) {
            this.#units.year += Math.trunc( this.#units.month / 12 );
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

                units.push( value + " " + ( Math.abs( value ) === 1
                    ? abbr
                    : abbr + "s" ) );
            }

            if ( units.length ) {
                this.#string = units.join( " " );
            }
            else {
                this.#string = "0 " + UNIT_ABBR[ EMPTY_UNIT ] + "s";
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

    toMilliseconds () {
        return this.#toUnit( "millisecond" );
    }

    toSeconds () {
        return this.#toUnit( "second" );
    }

    toMinutes () {
        return this.#toUnit( "minute" );
    }

    toHours () {
        return this.#toUnit( "hour" );
    }

    toDays () {
        return this.#toUnit( "day" );
    }

    toWeeks () {
        return this.#toUnit( "week" );
    }

    toMonths () {
        return this.#toUnit( "month" );
    }

    toYears () {
        return this.#toUnit( "year" );
    }

    getFormatRelativeDateParams () {
        if ( !this.#formatRelativeDateParams ) {
            const units = { ...this.#units };

            // weeks -> months
            if ( units.week >= 4 ) {
                units.month += Math.trunc( units.week / 4 );
                units.week = units.week % 4;
            }

            // months -> years
            if ( units.month >= 12 ) {
                units.year += Math.trunc( units.month / 12 );
                units.month = units.month % 12;
            }

            for ( const unit of [ "year", "month", "week", "day", "hour", "minute", "second" ] ) {
                if ( !units[ unit ] ) continue;

                this.#formatRelativeDateParams = [ units[ unit ], unit ];

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
                units.month += Math.trunc( units.week / 4 );
                units.week = units.week % 4;
            }

            // months -> years
            if ( units.month >= 12 ) {
                units.year += Math.trunc( units.month / 12 );
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

    subtractDate ( date ) {
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

    addInterval ( interval ) {
        interval = this.constructor.new( interval );

        const units = {};

        for ( const unit in UNIT_MILLISECONDS ) {
            units[ unit ] = this[ unit ] + interval[ unit ];
        }

        return new this.constructor( units );
    }

    subtractInterval ( interval ) {
        interval = this.constructor.new( interval );

        const units = {};

        for ( const unit in UNIT_MILLISECONDS ) {
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
            const millisecond = duration - Date.now();

            return {
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
                        [ UNITS[ unit ] ]: number,
                    };
                }
                else {
                    const millisecond = number * UNIT_MILLISECONDS[ UNITS[ unit ] ],
                        nanosecond = Numeric( millisecond ).decimal.multiply( 1_000_000 ).floor().number;

                    return {
                        millisecond,
                        nanosecond,
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
                    const unit = UNITS[ match[ n + 1 ] ];

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

            for ( const unit1 in UNIT_MILLISECONDS ) {
                if ( !this.#units[ unit1 ] ) continue;

                this.#_toUnit[ unit ] += this.#units[ unit1 ] * UNIT_MILLISECONDS[ unit1 ];

                if ( unit === unit1 ) break;
            }

            this.#_toUnit[ unit ] = Math.trunc( this.#_toUnit[ unit ] / UNIT_MILLISECONDS[ unit ] );
        }

        return this.#_toUnit[ unit ];
    }
}
