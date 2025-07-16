import "#lib/temporal";

// NOTE: https://www.man7.org/linux/man-pages/man5/crontab.5.html

const PRESETS = {
    "@yearly": "0 0 1 1 *",
    "@monthly": "0 0 1 * *",
    "@weekly": "0 0 * * 0",
    "@daily": "0 0 * * *",
    "@hourly": "0 * * * *",
    "@minutely": "* * * * *",
    "@secondly": "* * * * * *",
    "@weekdays": "0 0 * * 1-5",
    "@weekends": "0 0 * * 0,6",
};

const FIELDS = [
    {
        "name": "seconds",
        "min": 0,
        "max": 59,
    },
    {
        "name": "minutes",
        "min": 0,
        "max": 59,
    },
    {
        "name": "hours",
        "min": 0,
        "max": 23,
    },
    {
        "name": "days",
        "min": 1,
        "max": 31,
    },
    {
        "name": "months",
        "min": 1,
        "max": 12,
        "names": {
            "jan": 1,
            "feb": 2,
            "mar": 3,
            "apr": 4,
            "may": 5,
            "jun": 6,
            "jul": 7,
            "aug": 8,
            "sep": 9,
            "oct": 10,
            "nov": 11,
            "dec": 12,
        },
    },
    {
        "name": "daysOfWeek",
        "min": 0,
        "max": 6,
        "names": {
            "sun": 0,
            "mon": 1,
            "tue": 2,
            "wed": 3,
            "thu": 4,
            "fri": 5,
            "sat": 6,
        },
    },
];

const FIELDS_INDEX = Object.fromEntries( FIELDS.map( field => {
    return [ field.name, field ];
} ) );

export default class CronExpression {
    #expression;
    #timezone;
    #ignoreSeconds;
    #hasSeconds;
    #fields = {};

    constructor ( expression, { timezone, ignoreSeconds } = {} ) {
        this.#expression = expression;
        this.#ignoreSeconds = !!ignoreSeconds;

        if ( timezone ) {
            this.#timezone = Temporal.Now.zonedDateTimeISO( timezone ).timeZoneId;
        }
        else {
            this.#timezone = Temporal.Now.timeZoneId();
        }

        // resolve presets
        if ( PRESETS[ expression ] ) expression = PRESETS[ expression ];

        const fields = expression.split( " " );

        if ( fields.length < 5 || fields.length > 6 ) {
            throw new Error( `Cron expression is not valid: ${ expression }` );
        }

        if ( fields.length === 6 ) {
            if ( this.#ignoreSeconds ) {
                fields.shift();
            }
        }

        if ( fields.length === 5 ) {
            this.#hasSeconds = false;
        }
        else {
            this.#hasSeconds = true;
        }

        for ( let n = 0; n < fields.length; n++ ) {
            this.#parseField( fields[ n ], FIELDS[ n + ( this.#hasSeconds
                ? 0
                : 1 ) ] );
        }
    }

    // static
    static isValid ( value, options ) {
        try {
            new this( value, options );

            return true;
        }
        catch {
            return false;
        }
    }

    // properties
    get timezone () {
        return this.#timezone;
    }

    get ignoreSeconds () {
        return this.#ignoreSeconds;
    }

    get hasSeconds () {
        return this.#hasSeconds;
    }

    // public
    toString () {
        return this.#expression;
    }

    toJSON () {
        return this.toString();
    }

    getSchedule ( { fromDate, maxItems = 1 } = {} ) {
        if ( fromDate ) {
            fromDate = fromDate.toTemporalInstant().toZonedDateTimeISO( this.#timezone );
        }
        else {
            fromDate = Temporal.Now.instant().toZonedDateTimeISO( this.#timezone );
        }

        if ( this.#hasSeconds ) {

            // round to the seconds
            fromDate = fromDate.round( {
                "smallestUnit": "seconds",
                "roundingMode": "ceil",
            } );
        }
        else {

            // round to the minutes
            fromDate = fromDate.round( {
                "smallestUnit": "minutes",
                "roundingMode": "ceil",
            } );
        }

        const dates = [];

        for ( let n = 0; n < maxItems; n++ ) {
            fromDate = this.#getNextDate( fromDate );

            dates.push( new Date( fromDate.epochMilliseconds ) );

            if ( this.#hasSeconds ) {
                fromDate = fromDate.add( { "seconds": 1 } );
            }
            else {
                fromDate = fromDate.add( { "minutes": 1 } );
            }
        }

        return dates;
    }

    // private
    #parseField ( fieldValue, field ) {
        var restricted = false;

        const values = new Array( field.max + 1 );

        const ranges = fieldValue.split( "," );

        for ( const range of ranges ) {
            var [ body, step ] = range.split( "/" );

            if ( step ) {
                step = +step;
                if ( !Number.isInteger( step ) ) this.#throwError( fieldValue, field );
            }
            else {
                step = 0;
            }

            let start, end, random;

            // random value
            if ( body.includes( "~" ) ) {
                random = true;
                restricted = true;

                [ start, end ] = body.split( "~" );

                if ( !start ) {
                    start = field.min;
                }
                else if ( start === "*" ) {
                    this.#throwError( fieldValue, field );
                }

                if ( !end ) {
                    end = field.max;
                }
                else if ( end === "*" ) {
                    this.#throwError( fieldValue, field );
                }
            }

            // range
            else {
                [ start, end ] = body.split( "-" );

                if ( !start ) {
                    this.#throwError( fieldValue, field );
                }
                else if ( start === "*" ) {
                    start = field.min;
                    end = field.max;
                }

                // field is restricted
                else {
                    restricted = true;
                }

                if ( !end ) end = null;
            }

            if ( field.names?.[ start ] != null ) start = field.names[ start ];

            start = +start;
            if ( !Number.isInteger( start ) ) this.#throwError( fieldValue, field );

            // special case fordaysOfWeek, map 7 to 0
            if ( start === 7 && field.name === "daysOfWeek" ) {
                start = 0;
            }

            if ( start < field.min ) this.#throwError( fieldValue, field );

            if ( end != null ) {
                if ( field.names?.[ end ] != null ) end = field.names[ end ];

                end = +end;
                if ( !Number.isInteger( end ) ) this.#throwError( fieldValue, field );

                // special case fordaysOfWeek, map 7 to 0
                if ( end === 7 && field.name === "daysOfWeek" ) {
                    end = start;
                    start = 0;
                }

                if ( end > field.max ) this.#throwError( fieldValue, field );

                if ( end < start ) this.#throwError( fieldValue, field );

                if ( step > end - start ) this.#throwError( fieldValue, field );

                if ( random ) {
                    start = this.#getRandomValue( start, end );

                    end = null;
                }
            }

            // single value
            if ( end == null ) {
                if ( step ) this.#throwError( fieldValue, field );

                values[ start ] = true;
            }

            // range
            else {
                for ( let n = 0; n <= end - start; n++ ) {
                    if ( n % step ) continue;

                    values[ start + n ] = true;
                }
            }
        }

        this.#fields[ field.name ] = {
            restricted,
            values,
            "add": new Array( values.length ),
        };
    }

    #getRandomValue ( min, max ) {
        if ( min === max ) return min;

        return Math.floor( Math.random() * ( max - min + 1 ) ) + min;
    }

    #throwError ( fieldValue, field ) {
        throw new Error( `Cron expression field ${ field.name } is not valid: ${ fieldValue }` );
    }

    #getNextDate ( date ) {
        while ( true ) {

            // current month is not allowed
            if ( !this.#fields.months.values[ date.month ] ) {
                date = date
                    .add( {
                        "months": this.#getAddValue( date.month, FIELDS_INDEX.months ),
                    } )
                    .with( {
                        "day": 1,
                    } )
                    .round( {
                        "smallestUnit": "days",
                        "roundingMode": "floor",
                    } );
            }

            let addDays = 0,
                addDaysOfWeek = 0;

            // current day of month is not allowed
            if ( !this.#fields.days.values[ date.day ] ) {
                addDays = this.#getAddValue( date.day, FIELDS_INDEX.days );
            }

            // current day of week is not allowed
            if ( !this.#fields.daysOfWeek.values[ date.dayOfWeek === 7
                ? 0
                : date.dayOfWeek ] ) {
                addDaysOfWeek = this.#getAddValue( date.dayOfWeek === 7
                    ? 0
                    : date.dayOfWeek, FIELDS_INDEX.daysOfWeek );
            }

            // current day or day of week are not allowed
            ADD_DAYS: if ( addDays || addDaysOfWeek ) {

                // if days are restrictes
                // or days of week are restricted
                // match days OR day of week
                if ( this.#fields.days.restricted && this.#fields.daysOfWeek.restricted ) {

                    // current day or day of week are allowed
                    if ( !addDays || !addDaysOfWeek ) {
                        break ADD_DAYS;
                    }
                }

                date = date
                    .add( {
                        "days": addDays
                            ? ( addDaysOfWeek
                                ? ( addDays < addDaysOfWeek
                                    ? addDays
                                    : addDaysOfWeek )
                                : addDays )
                            : addDaysOfWeek,
                    } )
                    .round( {
                        "smallestUnit": "days",
                        "roundingMode": "floor",
                    } );

                continue;
            }

            // current hour is not allowed
            if ( !this.#fields.hours.values[ date.hour ] ) {
                date = date
                    .add( {
                        "hours": this.#getAddValue( date.hour, FIELDS_INDEX.hours ),
                    } )
                    .round( {
                        "smallestUnit": "hours",
                        "roundingMode": "floor",
                    } );

                continue;
            }

            // current minute is not allowed
            if ( !this.#fields.minutes.values[ date.minute ] ) {
                date = date
                    .add( {
                        "minutes": this.#getAddValue( date.minute, FIELDS_INDEX.minutes ),
                    } )
                    .round( {
                        "smallestUnit": "minutes",
                        "roundingMode": "floor",
                    } );

                continue;
            }

            // current second is not allowed
            if ( this.#fields.seconds && !this.#fields.seconds.values[ date.second ] ) {
                date = date.add( {
                    "seconds": this.#getAddValue( date.second, FIELDS_INDEX.seconds ),
                } );

                continue;
            }

            // found date, which is match all conditions
            break;
        }

        return date;
    }

    #getAddValue ( currentValue, field ) {
        var add = 0,
            values = this.#fields[ field.name ].values;

        // return cached
        if ( this.#fields[ field.name ].add[ currentValue ] ) {
            return this.#fields[ field.name ].add[ currentValue ];
        }

        for ( let n = currentValue + 1; n < values.length; n++ ) {
            add++;

            if ( values[ n ] ) return ( this.#fields[ field.name ].add[ currentValue ] = add );
        }

        for ( let n = field.min; n < currentValue; n++ ) {
            add++;

            if ( values[ n ] ) return ( this.#fields[ field.name ].add[ currentValue ] = add );
        }

        throw new Error( "Cron unable to find next value" );
    }
}
