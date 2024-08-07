import "#lib/temporal";

// NOTE https://www.man7.org/linux/man-pages/man5/crontab.5.html

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
        "name": "daysOfMonth",
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
        "min": 1,
        "max": 7,
        "map": { "0": 7 },
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

export default class CronFormat {
    #format;
    #timezone;
    #ignoreSeconds;
    #hasSeconds;
    #fields = {};

    constructor ( format, { timezone, ignoreSeconds } = {} ) {
        this.#format = format;
        this.#ignoreSeconds = !!ignoreSeconds;

        if ( timezone ) {

            // validate timezone
            Temporal.TimeZone.from( timezone );

            this.#timezone = timezone;
        }
        else {
            this.#timezone = Temporal.Now.timeZoneId();
        }

        const fields = format.split( " " );

        if ( fields.length < 5 || fields.length > 6 ) {
            throw Error( `Cron is not valid` );
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
            this.#parseField( fields[ n ], FIELDS[ n + ( this.#hasSeconds ? 0 : 1 ) ] );
        }
    }

    // static
    static isValid ( value, options ) {
        try {
            new this( value, options );

            return true;
        }
        catch ( e ) {
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
        return this.#format;
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

        // round to the seconds
        fromDate = fromDate.round( {
            "smallestUnit": "seconds",
            "roundingMode": "ceil",
        } );

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
        if ( fieldValue === "*" ) return;

        let usedValues = 0;

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

            let [ start, end ] = body.split( "-" );

            if ( !start ) {
                this.#throwError( fieldValue, field );
            }
            else if ( start === "*" ) {
                start = field.min;
                end = field.max;
            }
            else if ( field.names?.[ start ] != null ) {
                start = field.names[ start ];
            }

            start = +start;
            if ( !Number.isInteger( start ) ) this.#throwError( fieldValue, field );

            if ( start < field.min ) this.#throwError( fieldValue, field );

            if ( field.map?.[ start ] != null ) start = field.map[ start ];

            if ( end ) {
                if ( field.names?.[ end ] != null ) end = field.names[ end ];

                end = +end;
                if ( !Number.isInteger( end ) ) this.#throwError( fieldValue, field );

                if ( field.map?.[ end ] != null ) end = field.map[ end ];

                if ( end > field.max ) this.#throwError( fieldValue, field );

                if ( end < start ) this.#throwError( fieldValue, field );

                if ( step > end - start ) this.#throwError( fieldValue, field );

                for ( let n = 0; n <= end - start; n++ ) {
                    if ( n % step ) continue;

                    if ( !values[ start + n ] ) {
                        values[ start + n ] = true;

                        usedValues++;
                    }
                }
            }
            else {
                if ( step ) this.#throwError( fieldValue, field );

                if ( !values[ start ] ) {
                    values[ start ] = true;

                    usedValues++;
                }
            }
        }

        // store values if partial range used
        if ( usedValues < field.max ) {
            this.#fields[ field.name ] = values;
        }
    }

    #throwError ( fieldValue, field ) {
        throw Error( `Cron ${ field.name } field is not valid: ${ fieldValue }` );
    }

    #getNextDate ( date ) {
        while ( true ) {

            // months are restricted
            if ( this.#fields.months ) {

                // current month is not permitted
                if ( !this.#fields.months[ date.month ] ) {
                    date = date
                        .add( {
                            "months": this.#getAddValue( date.month, FIELDS.months ),
                        } )
                        .with( {
                            "day": 1,
                        } )
                        .round( {
                            "smallestUnit": "days",
                            "roundingMode": "floor",
                        } );

                    continue;
                }
            }

            let addDays = 0;

            // days of month are restricted
            if ( this.#fields.daysOfMonth ) {

                // current day of month is not permitted
                if ( !this.#fields.daysOfMonth[ date.day ] ) {
                    addDays = this.#getAddValue( date.day, FIELDS.daysOfMonth );
                }
            }

            if ( !this.#fields.daysOfMonth || !addDays ) {

                // days of week are restricted
                if ( this.#fields.daysOfWeek ) {

                    // current day of week is not permitted
                    if ( !this.#fields.daysOfWeek[ date.dayOfWeek ] ) {
                        const addDays1 = this.#getAddValue( date.dayOfWeek, FIELDS.daysOfWeek );

                        if ( addDays1 < addDays ) {
                            addDays = addDays1;
                        }
                    }
                }
            }

            if ( addDays ) {
                date = date
                    .add( {
                        "days": addDays,
                    } )
                    .round( {
                        "smallestUnit": "days",
                        "roundingMode": "floor",
                    } );

                continue;
            }

            // hours are restricted
            if ( this.#fields.hours ) {

                // current hour is not permitted
                if ( !this.#fields.hours[ date.hour ] ) {
                    date = date
                        .add( {
                            "hours": this.#getAddValue( date.hour, FIELDS.hours ),
                        } )
                        .round( {
                            "smallestUnit": "hours",
                            "roundingMode": "floor",
                        } );

                    continue;
                }
            }

            // minutes are restricted
            if ( this.#fields.minutes ) {

                // current minute is not permitted
                if ( !this.#fields.minutes[ date.minute ] ) {
                    date = date
                        .add( {
                            "minutes": this.#getAddValue( date.minute, FIELDS.minutes ),
                        } )
                        .round( {
                            "smallestUnit": "minutes",
                            "roundingMode": "floor",
                        } );

                    continue;
                }
            }

            // seconds are restricted
            if ( this.#fields.seconds ) {

                // current second is not permitted
                if ( !this.#fields.seconds[ date.second ] ) {
                    date = date.add( {
                        "seconds": this.#getAddValue( date.second, FIELDS.seconds ),
                    } );

                    continue;
                }
            }

            // found date, which is match all conditions
            break;
        }

        return date;
    }

    // XXX
    #getAddValue ( currentValue, field ) {
        return 1;
    }
}
