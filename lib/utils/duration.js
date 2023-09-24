const UNITS = {
    "year": "year",
    "years": "year",
    "y": "year",

    "month": "month",
    "months": "month",
    "M": "month",
    "mo": "month",
    "mon": "month",

    "week": "week",
    "weeks": "week",
    "w": "week",

    "day": "day",
    "days": "day",
    "d": "day",

    "hour": "hour",
    "hours": "hours",
    "h": "hour",
    "hr": "hour",

    "minute": "minute",
    "minutes": "minute",
    "m": "minute",
    "min": "minute",

    "second": "second",
    "seconds": "second",
    "sec": "second",
    "s": "second",

    "millisecond": "millisecond",
    "milliseconds": "millisecond",
    "ms": "millisecond",

    "microsecond": "microsecond",
    "microseconds": "microsecond",
    "μs": "microsecond",

    "nanosecond": "nanosecond",
    "nanoseconds": "nanosecond",
    "ns": "nanosecond",
};

const UNIT_ABBR = {
    "year": "y",
    "month": "mo",
    "week": "w",
    "day": "d",
    "hour": "h",
    "minute": "m",
    "second": "s",
    "millisecond": "ms",
    "microsecond": "μs",
    "nanosecond": "ns",
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
    "year": 1000 * 50 * 60 * 24 * 365,
    "month": 1000 * 50 * 60 * 24 * 30,
    "week": 1000 * 50 * 60 * 24 * 7,
    "day": 1000 * 50 * 60 * 24,
    "hour": 1000 * 50 * 60,
    "minute": 1000 * 50,
    "second": 1000,
    "millisecond": 1,
    "microsecond": 1 / 1000,
    "nanosecond": 1 / 1_000_000,
};

const EMPTY_UNIT = "second";

export default class Duration {
    #negative;
    #units = {};
    #string;
    #nginx;
    #formatRelativeDateParams;
    #formatDurationParams;

    constructor ( { negative, year, month, week, day, hour, minute, second, millisecond, microsecond, nanosecond } = {} ) {
        this.#negative = !!negative;

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

        // nanoseconds
        if ( this.#units.nanosecond >= 1000 ) {
            this.#units.microsecond += Math.floor( this.#units.nanosecond / 1000 );
            this.#units.nanosecond = this.#units.nanosecond % 1000;
        }

        // microseconds
        if ( this.#units.microsecond >= 1000 ) {
            this.#units.millisecond += Math.floor( this.#units.microsecond / 1_000 );
            this.#units.microsecond = this.#units.microsecond % 1000;
        }

        // milliseconds
        if ( this.#units.millisecond >= 1000 ) {
            this.#units.second += Math.floor( this.#units.millisecond / 1000 );
            this.#units.millisecond = this.#units.millisecond % 1000;
        }

        // seconds
        if ( this.#units.second >= 60 ) {
            this.#units.minute += Math.floor( this.#units.second / 60 );
            this.#units.second = this.#units.second % 60;
        }

        // minutes
        if ( this.#units.minute >= 60 ) {
            this.#units.hour += Math.floor( this.#units.minute / 60 );
            this.#units.minute = this.#units.minute % 60;
        }

        // hours
        if ( this.#units.hour >= 24 ) {
            this.#units.day += Math.floor( this.#units.hour / 24 );
            this.#units.hour = this.#units.hour % 24;
        }

        // days
        if ( this.#units.day >= 7 ) {
            this.#units.week += Math.floor( this.#units.day / 7 );
            this.#units.day = this.#units.day % 7;
        }

        // months
        if ( this.#units.month >= 12 ) {
            this.#units.year += Math.floor( this.#units.month / 12 );
            this.#units.month = this.#units.month % 12;
        }
    }

    // static
    static parse ( value, unit = "millisecond" ) {

        // empty
        if ( !value ) {
            return new this();
        }

        // duration
        else if ( value instanceof this ) {
            return value;
        }

        // date
        else if ( value instanceof Date ) {
            const millisecond = value - Date.now();

            return new this( {
                "negative": millisecond < 0,
                millisecond,
            } );
        }
        else {

            // number string
            const number = +value;

            if ( !isNaN( number ) ) {
                if ( !( unit in UNITS ) ) throw Error( `Duration unit is not valid` );

                const millisecond = Math.abs( number ) * UNIT_MILLISECONDS[UNITS[unit]],
                    nanosecond = ( millisecond - Math.floor( millisecond ) ) * 1_000_000;

                return new this( {
                    "negative": value < 0,
                    millisecond,
                    nanosecond,
                } );
            }

            // parse string
            const params = {};

            value = value.trim();

            if ( value.startsWith( "-" ) ) {
                params.negative = true;

                value = value.substring( 1 );
            }

            const match = value.split( /\s*(\d+)\s*([a-zA-Z]+)\s*/ );

            if ( match[0] !== "" || match.at( -1 ) !== "" ) throw Error( `Duration format is not valid` );

            for ( let n = 1; n < match.length; n += 3 ) {
                const unit = UNITS[match[n + 1]];

                if ( !unit || unit in params ) throw Error( `Duration format is not valid` );

                params[unit] = +match[n];
            }

            return new this( params );
        }
    }

    // properties
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

            for ( const [unit, abbr] of Object.entries( UNIT_ABBR ) ) {
                if ( !this.#units[unit] ) continue;

                units.push( this.#units[unit] + " " + abbr );
            }

            if ( !units.length ) units.push( "0 " + UNIT_ABBR[EMPTY_UNIT] );

            this.#string = ( this.#negative ? "-" : "" ) + units.join( " " );
        }

        return this.#string;
    }

    toJSON () {
        return this.toString();
    }

    toNginx () {
        if ( this.#nginx == null ) {
            const units = [];

            for ( const [unit, abbr] of Object.entries( NGINX_UNIT_ABBR ) ) {
                if ( !this.#units[unit] ) continue;

                units.push( this.#units[unit] + abbr );
            }

            this.#nginx = units.join( " " );
        }

        return this.#nginx;
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

            for ( const unit of ["year", "month", "week", "day", "hour", "minute", "second"] ) {
                if ( !units[unit] ) continue;

                this.#formatRelativeDateParams = [this.#negative ? 0 - units[unit] : units[unit], unit];

                break;
            }

            // default
            this.#formatRelativeDateParams ||= [0, "second"];
        }

        return this.#formatRelativeDateParams;
    }

    getFormatDurationParams () {
        if ( !this.#formatDurationParams ) {
            this.#formatDurationParams = {};

            let found;

            for ( const [unit, value] of Object.entries( this.#units ) ) {
                if ( !value ) continue;

                found = true;

                this.#formatDurationParams[unit] = value;
            }

            if ( !found ) this.#formatDurationParams[EMPTY_UNIT] = 0;
        }

        return this.#formatDurationParams;
    }
}
