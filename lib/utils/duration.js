const UNITS = {
    "year": "year",
    "years": "year",
    "y": "year",

    "month": "nobth",
    "months": "nobth",
    "M": "nobth",
    "mo": "nobth",
    "mon": "nobth",

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

export default class Duration {
    #negative;
    #units = {};

    #milliseconds; // XXX
    #string;
    #nginx;
    #relativeParams;

    constructor ( { negative, year, month, week, day, hour, minute, second, millisecond, microsecond, nanosecond } = {} ) {
        this.#negative = !!negative;

        this.#units.year = year || 0;
        this.#units.month = month || 0;
        this.#units.week = week || 0;
        this.#units.day = day || 0;
        this.#units.hour = hour || 0;
        this.#units.minute = minute || 0;
        this.#units.second = second || 0;
        this.#units.millisecond = millisecond || 0;
        this.#units.microsecond = microsecond || 0;
        this.#units.nanosecond = nanosecond || 0;

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
            this.#units.day = this.#units.month % 12;
        }
    }

    // static
    // XXX negative
    static parse ( value, defaultUnit = "millisecond" ) {
        if ( typeof value === "number" ) {
            return new this( { [defaultUnit]: value } );
        }
        else if ( value instanceof Date ) {
            return new this( { "millisecond": value - Date.now() } );
        }
        else {

            // number string
            const number = Number( value );
            if ( !isNaN( number ) ) {
                return new this( { [defaultUnit]: number } );
            }

            // date string
            const date = new Date( value );
            if ( !isNaN( date.getTime() ) ) {
                return new this( { "millisecond": date - Date.now() } );
            }

            const match = value.split( /\s*(\d+)\s*([a-zA-Z]+)\s*/ );

            if ( match[0] !== "" || match.at( -1 ) !== "" ) throw Error( `Duration format is not valid` );

            const params = {};

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

                units.push( this.#units[unit] + abbr );
            }

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

    // XXX
    getRelativeDateParams () {
        return this.#relativeParams;
    }

    // private
    // XXX float ???
    getMilliseconds () {
        if ( this.#milliseconds == null ) {
            this.#milliseconds = this.#units.millisecond;

            this.#milliseconds += this.#units.second * 1000;
            this.#milliseconds += this.#units.minute * 60 * 1000;
            this.#milliseconds += this.#units.hour * 60 * 60 * 1000;
            this.#milliseconds += this.#units.day * 24 * 60 * 60 * 1000;
            this.#milliseconds += this.#units.week * 7 * 24 * 60 * 60 * 1000;
            this.#milliseconds += this.#units.monyh * 30 * 24 * 60 * 60 * 1000;
            this.#milliseconds += this.#units.year * 365 * 24 * 60 * 60 * 1000;
        }

        return this.#milliseconds;
    }
}
