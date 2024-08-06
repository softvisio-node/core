import "#lib/temporal";
import { DateTime } from "#lib/luxon";
import Events from "#lib/events";

export const CONSTRAINTS = [
    [ 0, 59 ],
    [ 0, 59 ],
    [ 0, 23 ],
    [ 1, 31 ],
    [ 0, 11 ],
    [ 0, 6 ],
];

const MONTH_CONSTRAINTS = [
    31,
    29, // support leap year...not perfect
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
];

const PARSE_DEFAULTS = [ "0", "*", "*", "*", "*", "*" ];

const ALIASES = {
    "jan": 0,
    "feb": 1,
    "mar": 2,
    "apr": 3,
    "may": 4,
    "jun": 5,
    "jul": 6,
    "aug": 7,
    "sep": 8,
    "oct": 9,
    "nov": 10,
    "dec": 11,
    "sun": 0,
    "mon": 1,
    "tue": 2,
    "wed": 3,
    "thu": 4,
    "fri": 5,
    "sat": 6,
};

export const TIME_UNITS = [ "second", "minute", "hour", "dayOfMonth", "month", "dayOfWeek" ];

const TIME_UNITS_LEN = TIME_UNITS.length;

const PRESETS = {
    "@yearly": "0 0 0 1 0 *",
    "@monthly": "0 0 0 1 * *",
    "@weekly": "0 0 0 * * 0",
    "@daily": "0 0 0 * * *",
    "@hourly": "0 0 * * * *",
    "@minutely": "0 * * * * *",
    "@secondly": "* * * * * *",
    "@weekdays": "0 0 0 * * 1-5",
    "@weekends": "0 0 0 * * 0,6",
};

const RE_WILDCARDS = /\*/g,
    RE_RANGE = /^(\d+)(?:-(\d+))?(?:\/(\d+))?$/g;

class CronFormat {
    #source;
    #isValid;
    #timeunits = {};

    constructor ( source ) {
        this.#source = source;

        TIME_UNITS.forEach( timeUnit => {
            this.#timeunits[ timeUnit ] = {};
        } );

        try {
            this.#parse( source );

            this.#verify();

            this.#isValid = true;
        }
        catch ( e ) {
            this.#isValid = false;
        }
    }

    // properties
    get source () {
        return this.#source;
    }

    get isValid () {
        return this.#isValid;
    }

    get timeunits () {
        return this.#timeunits;
    }

    // private
    /*
     * Parse the cron syntax into something useful for selecting the next execution time.
     *
     * Algorithm:
     * - Replace preset
     * - Replace aliases in the source.
     * - Trim string and split for processing.
     * - Loop over split options (ms -> month):
     *   - Get the value (or default) in the current position.
     *   - Parse the value.
     */
    #parse ( source ) {
        source = source.toLowerCase();

        if ( source in PRESETS ) {
            source = PRESETS[ source ];
        }

        source = source.replace( /[a-z]{1,3}/gi, alias => {
            if ( alias in ALIASES ) {
                return ALIASES[ alias ];
            }

            throw new Error( `Unknown alias: ${ alias }` );
        } );

        var units = source.trim().split( /\s+/ );

        // seconds are optional
        if ( units.length < TIME_UNITS_LEN - 1 ) {
            throw new Error( "Too few fields" );
        }

        if ( units.length > TIME_UNITS_LEN ) {
            throw new Error( "Too many fields" );
        }

        var unitsLen = units.length;
        for ( var i = 0; i < TIME_UNITS_LEN; i++ ) {

            // If the split source string doesn't contain all digits,
            // assume defaults for first n missing digits.
            // This adds support for 5-digit standard cron syntax
            var cur = units[ i - ( TIME_UNITS_LEN - unitsLen ) ] || PARSE_DEFAULTS[ i ];
            this.#parseField( cur, TIME_UNITS[ i ], CONSTRAINTS[ i ] );
        }
    }

    /*
     * Parse individual field from the cron syntax provided.
     *
     * Algorithm:
     * - Split field by commas aand check for wildcards to ensure proper user.
     * - Replace wildcard values with <low>-<high> boundaries.
     * - Split field by commas and then iterate over ranges inside field.
     *   - If range matches pattern then map over matches using replace (to parse the range by the regex pattern)
     *   - Starting with the lower bounds of the range iterate by step up to the upper bounds and toggle the CronTime field value flag on.
     */
    #parseField ( value, type, constraints ) {
        var typeObj = this.#timeunits[ type ];
        var pointer;
        var low = constraints[ 0 ];
        var high = constraints[ 1 ];

        var fields = value.split( "," );
        fields.forEach( field => {
            var wildcardIndex = field.indexOf( "*" );
            if ( wildcardIndex !== -1 && wildcardIndex !== 0 ) {
                throw new Error( `Field (${ field }) has an invalid wildcard expression` );
            }
        } );

        // * is a shortcut to [low-high] range for the field
        value = value.replace( RE_WILDCARDS, `${ low }-${ high }` );

        // commas separate information, so split based on those
        var allRanges = value.split( "," );

        for ( var i = 0; i < allRanges.length; i++ ) {
            if ( allRanges[ i ].match( RE_RANGE ) ) {
                allRanges[ i ].replace( RE_RANGE, ( $0, lower, upper, step ) => {
                    lower = parseInt( lower, 10 );
                    upper = parseInt( upper, 10 ) || undefined;

                    const wasStepDefined = !isNaN( parseInt( step, 10 ) );
                    if ( step === "0" ) {
                        throw new Error( `Field (${ type }) has a step of zero` );
                    }
                    step = parseInt( step, 10 ) || 1;

                    if ( upper && lower > upper ) {
                        throw new Error( `Field (${ type }) has an invalid range` );
                    }

                    const outOfRangeError = lower < low || ( upper && upper > high ) || ( !upper && lower > high );

                    if ( outOfRangeError ) {
                        throw new Error( `Field value (${ value }) is out of range` );
                    }

                    // Positive integer higher than constraints[0]
                    lower = Math.min( Math.max( low, ~~Math.abs( lower ) ), high );

                    // Positive integer lower than constraints[1]
                    if ( upper ) {
                        upper = Math.min( high, ~~Math.abs( upper ) );
                    }
                    else {

                        // If step is provided, the default upper range is the highest value
                        upper = wasStepDefined ? high : lower;
                    }

                    // Count from the lower barrier to the upper
                    pointer = lower;

                    do {
                        typeObj[ pointer ] = true; // mutates the field objects values inside CronTime
                        pointer += step;
                    } while ( pointer <= upper );
                } );
            }
            else {
                throw new Error( `Field (${ type }) cannot be parsed` );
            }
        }
    }

    /*
     * Ensure that the syntax parsed correctly and correct the specified values if needed.
     */
    #verify () {
        var months = Object.keys( this.#timeunits.month );
        var dom = Object.keys( this.#timeunits.dayOfMonth );
        var ok = false;

        /* if a dayOfMonth is not found in all months, we only need to fix the last
                 wrong month  to prevent infinite loop */
        var lastWrongMonth = NaN;
        for ( var i = 0; i < months.length; i++ ) {
            var m = months[ i ];
            var con = MONTH_CONSTRAINTS[ parseInt( m, 10 ) ];

            for ( var j = 0; j < dom.length; j++ ) {
                var day = dom[ j ];
                if ( day <= con ) {
                    ok = true;
                }
            }

            if ( !ok ) {

                // save the month in order to be fixed if all months fails (infinite loop)
                lastWrongMonth = m;
                console.warn( `Month '${ m }' is limited to '${ con }' days.` );
            }
        }

        // infinite loop detected (dayOfMonth is not found in all months)
        if ( !ok ) {
            var notOkCon = MONTH_CONSTRAINTS[ parseInt( lastWrongMonth, 10 ) ];
            for ( var k = 0; k < dom.length; k++ ) {
                var notOkDay = dom[ k ];
                if ( notOkDay > notOkCon ) {
                    delete this.#timeunits.dayOfMonth[ notOkDay ];
                    var fixedDay = Number( notOkDay ) % notOkCon;
                    this.#timeunits.dayOfMonth[ fixedDay ] = true;
                }
            }
        }
    }
}

export default class Cron extends Events {
    #source;
    #timezone;
    #maxTicks;
    #runMissed;
    #isRealDate;
    #isStarted = false;
    #lastDate;
    #ticks = 0;
    #nextDate;
    #timeout;
    #unref;
    #timeunits;
    #toString;

    constructor ( source, { timezone, maxTicks, runMissed } = {} ) {
        super();

        this.#source = source;
        this.#maxTicks = maxTicks;
        this.#runMissed = runMissed;

        // number - milliseconds
        if ( typeof this.#source === "number" ) {
            this.#isRealDate = true;

            this.#source = Temporal.Instant.fromEpochMilliseconds( this.#source );
        }

        // Date
        if ( this.#source instanceof Date ) {
            this.#isRealDate = true;

            this.#source = this.#source.toTemporalInstant();
        }

        // cron
        else {
            const cronFormat = new CronFormat( this.#source );

            if ( !cronFormat.isValid ) throw Error( `Cron is not valid` );

            this.#timeunits = cronFormat.timeunits;
        }

        if ( timezone ) {

            // validate
            Temporal.TimeZone.from( timezone );

            this.#timezone = timezone;
        }

        if ( this.#isRealDate ) {
            if ( this.#timezone ) {
                this.#source = this.#source.toZonedDateTimeISO( this.#timezone );
            }
            else {
                this.#source = this.#source.toZonedDateTimeISO( Temporal.Now.timeZoneId() );
            }
        }
    }

    // static
    static isValid ( value ) {
        return new CronFormat( value ).isValid;
    }

    // properties
    get isStarted () {
        return this.#isStarted;
    }

    get ticks () {
        return this.#ticks;
    }

    get lastDate () {
        return this.#lastDate;
    }

    get nextDate () {
        if ( this.#nextDate && this.#nextDate > new Date() ) return this.#nextDate;

        this.#nextDate = this.getNextDates( 1 )[ 0 ];

        return this.#nextDate;
    }

    get timeout () {
        return Math.max( -1, ( this.nextDate ?? -1 ) - new Date() );
    }

    // public
    toString () {
        this.#toString ??= this.#source ? this.#source.toString() : TIME_UNITS.map( timeName => this.#wcOrAll( timeName ) ).join( " " );

        return this.#toString;
    }

    toJSON () {
        return this.toString();
    }

    getNextDates ( { num = 1, from } = {} ) {
        var date;

        if ( from ) {
            date = from.toTemporalInstant();
        }
        else {
            date = Temporal.Now.instant();
        }

        if ( this.#timezone ) {
            date = date.toZonedDateTimeISO( this.#timezone );
        }
        else {
            date = date.toZonedDateTimeISO( Temporal.Now.timeZoneId() );
        }

        const dates = [];

        if ( this.#isRealDate ) {
            if ( this.#source.epochMilliseconds >= date.epochMilliseconds ) {
                dates.push( new Date( this.#source.epochMilliseconds ) );
            }
        }
        else {
            for ( ; num > 0; num-- ) {
                date = this.#getNextDateFrom( date );

                dates.push( new Date( this.#source.epochMilliseconds ) );
            }
        }

        return dates;
    }

    tick () {
        this.#onTick( true );

        return this;
    }

    start () {
        if ( this.#isStarted ) return this;

        this.#lastDate = null;
        this.#ticks = 0;
        this.#isStarted = true;

        this.#setTimeout();

        return this;
    }

    stop () {
        if ( !this.#isStarted ) return this;

        this.#isStarted = false;

        this.#clearTimeout();

        this.emit( "stop", this );

        return this;
    }

    ref () {
        this.#unref = false;

        if ( this.#timeout ) this.#timeout.ref();

        return this;
    }

    unref () {
        this.#unref = true;

        if ( this.#timeout ) this.#timeout.unref();

        return this;
    }

    // private
    #setTimeout () {
        this.#clearTimeout();

        const timeout = this.timeout;

        if ( timeout < 0 && this.#isRealDate ) {
            if ( this.#runMissed ) this.tick();

            this.stop();
        }
        else {
            this.#timeout = setTimeout( this.#onTick.bind( this ), timeout );

            if ( this.#unref ) this.#timeout.unref();
        }
    }

    #clearTimeout () {
        if ( this.#timeout ) {
            clearTimeout( this.#timeout );

            this.#timeout = null;
        }
    }

    #onTick ( manual ) {
        this.#lastDate = new Date();
        this.#ticks++;

        var stop;

        if ( this.#maxTicks && this.#ticks >= this.#maxTicks ) stop = true;

        if ( !manual && !stop ) {
            if ( this.#isRealDate ) stop = true;
            else this.#setTimeout();
        }

        this.emit( "tick", this );

        if ( stop ) this.stop();
    }

    #getWeekDay ( date ) {
        return date.weekday === 7 ? 0 : date.weekday;
    }

    // XXX
    /**
     * Get next date matching the specified cron time.
     *
     * Algorithm:
     * - Start with a start date and a parsed crontime.
     * - Loop until 5 seconds have passed, or we found the next date.
     * - Within the loop:
     *   - If it took longer than 5 seconds to select a date, throw an exception.
     *   - Find the next month to run at.
     *   - Find the next day of the month to run at.
     *   - Find the next day of the week to run at.
     *   - Find the next hour to run at.
     *   - Find the next minute to run at.
     *   - Find the next second to run at.
     *   - Check that the chosen time does not equal the current execution.
     * - Return the selected date object.
     */
    #getNextDateFrom ( start ) {

        // round to seconds
        start = start.round( {
            "smallestUnit": "seconds",
            "roundingMode": "ceil",
        } );

        var date = start;

        // it shouldn't take more than 5 seconds to find the next execution time
        // being very generous with this. Throw error if it takes too long to find the next time to protect from
        // infinite loop.
        const timeout = Date.now() + 5000;

        // determine next date
        while ( true ) {

            // XXX
            var diff = date - start;

            // hard stop if the current date is after the expected execution
            if ( Date.now() > timeout ) {
                throw Error( `Something went wrong. cron reached maximum iterations.
                            Please open an  issue (https://github.com/kelektiv/node-cron/issues/new) and provide the following string
                            Cron String: ${ this } - UTC offset: ${ date.format( "Z" ) } - current Date: ${ DateTime.local().toString() }` );
            }

            if ( !( date.month - 1 in this.#timeunits.month ) && Object.keys( this.#timeunits.month ).length !== 12 ) {
                date = date.plus( { "months": 1 } );
                date = date.set( { "day": 1, "hour": 0, "minute": 0, "second": 0 } );
                continue;
            }

            if ( !( date.day in this.#timeunits.dayOfMonth ) && Object.keys( this.#timeunits.dayOfMonth ).length !== 31 && !( this.#getWeekDay( date ) in this.#timeunits.dayOfWeek && Object.keys( this.#timeunits.dayOfWeek ).length !== 7 ) ) {
                date = date.plus( { "days": 1 } );
                date = date.set( { "hour": 0, "minute": 0, "second": 0 } );
                continue;
            }

            if ( !( this.#getWeekDay( date ) in this.#timeunits.dayOfWeek ) && Object.keys( this.#timeunits.dayOfWeek ).length !== 7 && !( date.day in this.#timeunits.dayOfMonth && Object.keys( this.#timeunits.dayOfMonth ).length !== 31 ) ) {
                date = date.plus( { "days": 1 } );
                date = date.set( { "hour": 0, "minute": 0, "second": 0 } );
                continue;
            }

            if ( !( date.hour in this.#timeunits.hour ) && Object.keys( this.#timeunits.hour ).length !== 24 ) {
                date = date.set( {
                    "hour": date.hour === 23 && diff > 86400000 ? 0 : date.hour + 1,
                } );
                date = date.set( { "minute": 0, "second": 0 } );
                continue;
            }

            if ( !( date.minute in this.#timeunits.minute ) && Object.keys( this.#timeunits.minute ).length !== 60 ) {
                date = date.set( {
                    "minute": date.minute === 59 && diff > 3600000 ? 0 : date.minute + 1,
                } );
                date = date.set( { "second": 0 } );
                continue;
            }

            if ( !( date.second in this.#timeunits.second ) && Object.keys( this.#timeunits.second ).length !== 60 ) {
                date = date.set( {
                    "second": date.second === 59 && diff > 60000 ? 0 : date.second + 1,
                } );
                continue;
            }

            if ( date.epochMilliseconds === start.epochMilliseconds ) {
                date = date.set( { "second": date.second + 1 } );
                continue;
            }

            break;
        }

        return date;
    }

    /**
     * wildcard, or all params in array (for to string)
     */
    #wcOrAll ( type ) {
        if ( this.#hasAll( type ) ) {
            return "*";
        }

        var all = [];
        for ( var time in this.#timeunits[ type ] ) {
            all.push( time );
        }

        return all.join( "," );
    }

    #hasAll ( type ) {
        var constraints = CONSTRAINTS[ TIME_UNITS.indexOf( type ) ];

        for ( var i = constraints[ 0 ], n = constraints[ 1 ]; i < n; i++ ) {
            if ( !( i in this.#timeunits[ type ] ) ) {
                return false;
            }
        }

        return true;
    }
}
