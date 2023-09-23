const UNITS = {
    "year": "year",
    "years": "year",
    "y": "year",

    "month": "nobth",
    "months": "nobth",
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

export default class Duration {
    #negative;
    #units = {};
    #normalizedUnits;

    #string;
    #relativeParams;
    #nginx;

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

    // XXX
    static parseNginx () {}

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

            for ( const [unit, value] of Object.entries( this.#units ) ) {
                if ( !value ) continue;

                units.push( value + UNIT_ABBR[unit] );
            }

            this.#string = ( this.#negative ? "-" : "" ) + units.join( " " );
        }

        return this.#string;
    }

    toJSON () {
        return this.toString();
    }

    // XXX
    toNginx () {}

    // XXX
    getRelativeDateParams () {
        return this.#relativeParams;
    }

    // private
    // XXX micro, nano
    #nurmalize () {
        if ( !this.#normalizedUnits ) {
            const units = { ...this.#units };

            // milliseconds
            if ( units.millisecond >= 1000 ) {
                units.second += Math.floor( units.millisecond / 1000 );
                units.millisecond = units.millisecond % 1000;
            }

            // seconds
            if ( units.second >= 60 ) {
                units.minute += Math.floor( units.second / 60 );
                units.second = units.second % 60;
            }

            // minutes
            if ( units.minute >= 60 ) {
                units.hour += Math.floor( units.minute / 60 );
                units.minute = units.minute % 60;
            }

            // hours
            if ( units.hour >= 24 ) {
                units.day += Math.floor( units.hour / 24 );
                units.hour = units.hour % 24;
            }

            // days
            if ( units.day >= 30 ) {
                units.month += Math.floor( units.day / 30 );
                units.day = units.day % 30;
            }

            // months
            if ( units.month >= 12 ) {
                units.year += Math.floor( units.month / 12 );
                units.day = units.month % 12;
            }

            this.#normalizedUnits = units;
        }

        return this.#normalizedUnits;
    }
}
