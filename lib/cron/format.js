export const CONSTRAINTS = [
    [0, 59],
    [0, 59],
    [0, 23],
    [1, 31],
    [0, 11],
    [0, 6],
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

const PARSE_DEFAULTS = ["0", "*", "*", "*", "*", "*"];

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

export const TIME_UNITS = ["second", "minute", "hour", "dayOfMonth", "month", "dayOfWeek"];

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

const RE_WILDCARDS = /\*/g;

const RE_RANGE = /^(\d+)(?:-(\d+))?(?:\/(\d+))?$/g;

export default class CronFormat {
    #source;
    #isValid;
    #timeunits;

    constructor ( source ) {
        this.#source = source;

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
            source = PRESETS[source];
        }

        source = source.replace( /[a-z]{1,3}/gi, alias => {
            if ( alias in ALIASES ) {
                return ALIASES[alias];
            }

            throw new Error( `Unknown alias: ${alias}` );
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
            var cur = units[i - ( TIME_UNITS_LEN - unitsLen )] || PARSE_DEFAULTS[i];
            this.#parseField( cur, TIME_UNITS[i], CONSTRAINTS[i] );
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
        var typeObj = this.#timeunits[type];
        var pointer;
        var low = constraints[0];
        var high = constraints[1];

        var fields = value.split( "," );
        fields.forEach( field => {
            var wildcardIndex = field.indexOf( "*" );
            if ( wildcardIndex !== -1 && wildcardIndex !== 0 ) {
                throw new Error( `Field (${field}) has an invalid wildcard expression` );
            }
        } );

        // * is a shortcut to [low-high] range for the field
        value = value.replace( RE_WILDCARDS, `${low}-${high}` );

        // commas separate information, so split based on those
        var allRanges = value.split( "," );

        for ( var i = 0; i < allRanges.length; i++ ) {
            if ( allRanges[i].match( RE_RANGE ) ) {
                allRanges[i].replace( RE_RANGE, ( $0, lower, upper, step ) => {
                    lower = parseInt( lower, 10 );
                    upper = parseInt( upper, 10 ) || undefined;

                    const wasStepDefined = !isNaN( parseInt( step, 10 ) );
                    if ( step === "0" ) {
                        throw new Error( `Field (${type}) has a step of zero` );
                    }
                    step = parseInt( step, 10 ) || 1;

                    if ( upper && lower > upper ) {
                        throw new Error( `Field (${type}) has an invalid range` );
                    }

                    const outOfRangeError = lower < low || ( upper && upper > high ) || ( !upper && lower > high );

                    if ( outOfRangeError ) {
                        throw new Error( `Field value (${value}) is out of range` );
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
                        typeObj[pointer] = true; // mutates the field objects values inside CronTime
                        pointer += step;
                    } while ( pointer <= upper );
                } );
            }
            else {
                throw new Error( `Field (${type}) cannot be parsed` );
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
            var m = months[i];
            var con = MONTH_CONSTRAINTS[parseInt( m, 10 )];

            for ( var j = 0; j < dom.length; j++ ) {
                var day = dom[j];
                if ( day <= con ) {
                    ok = true;
                }
            }

            if ( !ok ) {

                // save the month in order to be fixed if all months fails (infinite loop)
                lastWrongMonth = m;
                console.warn( `Month '${m}' is limited to '${con}' days.` );
            }
        }

        // infinite loop detected (dayOfMonth is not found in all months)
        if ( !ok ) {
            var notOkCon = MONTH_CONSTRAINTS[parseInt( lastWrongMonth, 10 )];
            for ( var k = 0; k < dom.length; k++ ) {
                var notOkDay = dom[k];
                if ( notOkDay > notOkCon ) {
                    delete this.#timeunits.dayOfMonth[notOkDay];
                    var fixedDay = Number( notOkDay ) % notOkCon;
                    this.#timeunits.dayOfMonth[fixedDay] = true;
                }
            }
        }
    }
}
