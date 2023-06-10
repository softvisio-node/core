import { DateTime } from "#lib/luxon";
import Events from "#lib/events";
import { default as CronFormat, CONSTRAINTS, TIME_UNITS } from "#lib/cron/format";

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
    #timeunits = {};
    #toString;

    constructor ( source, { timezone, maxTicks, runMissed } = {} ) {
        super();

        this.#source = source;
        this.#maxTicks = maxTicks;
        this.#runMissed = runMissed;

        if ( timezone ) {
            const dt = DateTime.fromObject( {}, { "zone": timezone } );
            if ( dt.invalid ) throw Error( "Invalid timezone." );

            this.#timezone = timezone;
        }

        TIME_UNITS.forEach( timeUnit => {
            this.#timeunits[timeUnit] = {};
        } );

        if ( this.#source instanceof Date || this.#source instanceof DateTime ) {
            this.#isRealDate = true;

            if ( this.#source instanceof Date ) {
                this.#source = DateTime.fromJSDate( this.#source );
            }
        }
        else if ( typeof this.#source === "number" ) {
            this.#isRealDate = true;

            this.#source = DateTime.fromMillis( this.#source );
        }
        else {
            const cronFormat = new CronFormat( this.#source );

            if ( !cronFormat.isValid ) throw Error( `Cron is not valid` );

            this.#timeunits = cronFormat.timeunits;
        }
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

        this.#nextDate = this.nextDates( 1 )[0];

        return this.#nextDate;
    }

    get timeout () {
        return Math.max( -1, ( this.nextDate ?? -1 ) - new Date() );
    }

    // public
    toString () {
        this.#toString ??= TIME_UNITS.map( timeName => this.#wcOrAll( timeName ) ).join( " " );

        return this.#toString;
    }

    toJSON () {
        return this.toString();
    }

    nextDates ( { num = 1, from } = {} ) {
        from = from ? DateTime.fromJSDate( from ) : DateTime.local();

        var date = this.#isRealDate ? this.#source : from;

        if ( this.#timezone ) {
            date = date.setZone( this.#timezone );
        }

        const dates = [];

        if ( this.#isRealDate ) {
            if ( date >= from ) dates.push( date.toJSDate() );
        }
        else {
            for ( ; num > 0; num-- ) {
                date = this.#getNextDateFrom( date );

                dates.push( date.toJSDate() );
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
    #getNextDateFrom ( start, zone ) {
        if ( start instanceof Date ) {
            start = DateTime.fromJSDate( start );
        }
        var date = start;
        var firstDate = start.toMillis();
        if ( zone ) {
            date = date.setZone( zone );
        }
        if ( !this.#isRealDate ) {
            if ( date.millisecond > 0 ) {
                date = date.set( { "millisecond": 0, "second": date.second + 1 } );
            }
        }

        if ( date.invalid ) {
            throw Error( "ERROR: You specified an invalid date." );
        }

        // it shouldn't take more than 5 seconds to find the next execution time
        // being very generous with this. Throw error if it takes too long to find the next time to protect from
        // infinite loop.
        var timeout = Date.now() + 5000;

        // determine next date
        while ( true ) {
            var diff = date - start;

            // hard stop if the current date is after the expected execution
            if ( Date.now() > timeout ) {
                throw Error( `Something went wrong. cron reached maximum iterations.
                            Please open an  issue (https://github.com/kelektiv/node-cron/issues/new) and provide the following string
                            Time Zone: ${zone || '""'} - Cron String: ${this} - UTC offset: ${date.format( "Z" )} - current Date: ${DateTime.local().toString()}` );
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

            if ( date.toMillis() === firstDate ) {
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
        for ( var time in this.#timeunits[type] ) {
            all.push( time );
        }

        return all.join( "," );
    }

    #hasAll ( type ) {
        var constraints = CONSTRAINTS[TIME_UNITS.indexOf( type )];

        for ( var i = constraints[0], n = constraints[1]; i < n; i++ ) {
            if ( !( i in this.#timeunits[type] ) ) {
                return false;
            }
        }

        return true;
    }
}
