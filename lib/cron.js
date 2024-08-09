import "#lib/temporal";
import CronExpression from "#lib/cron/expression";
import Events from "#lib/events";

export default class Cron extends Events {
    #cronExpression;
    #date;
    #timezone;
    #maxTicks;
    #isStarted = false;
    #lastTickDate;
    #ticks = 0;
    #nexTicktDate;
    #timeout;
    #unref;

    constructor ( expression, { timezone, ignoreSeconds, maxTicks } = {} ) {
        super();

        this.#maxTicks = maxTicks;

        // number - milliseconds
        if ( typeof expression === "number" ) {
            expression = new Date( expression );
        }

        // Date
        if ( expression instanceof Date ) {
            this.#date = expression.toTemporalInstant();
        }

        // cron
        else {
            this.#cronExpression = new CronExpression( expression, { timezone, ignoreSeconds } );
        }

        if ( timezone ) {
            this.#timezone = Temporal.TimeZone.from( timezone ).id;
        }
        else {
            this.#timezone = Temporal.Now.timeZoneId();
        }

        if ( this.#date ) {
            this.#date = this.#date.toZonedDateTimeISO( this.#timezone );
        }
    }

    // static
    static isValid ( expression, options ) {
        return CronExpression.isValid( expression, options );
    }

    // properties
    get timeZone () {
        return this.#timezone;
    }

    get maxTicks () {
        return this.#maxTicks;
    }

    get ignoreSeconds () {
        return this.#cronExpression?.ignoreSeconds ?? false;
    }

    get hasSeconds () {
        return this.#cronExpression?.hasSeconds ?? false;
    }

    get isStarted () {
        return this.#isStarted;
    }

    get ticks () {
        return this.#ticks;
    }

    get lastTickDate () {
        return this.#lastTickDate;
    }

    get nexTicktDate () {
        if ( this.#nexTicktDate && this.#nexTicktDate > new Date() ) return this.#nexTicktDate;

        this.#nexTicktDate = this.getSchedule( { "maxItems": 1 } )[ 0 ];

        return this.#nexTicktDate;
    }

    // public
    toString () {
        return this.#cronExpression ? this.#cronExpression.toString() : this.#date.toISOStriing();
    }

    toJSON () {
        return this.toString();
    }

    getSchedule ( { maxItems = 1, fromDate } = {} ) {
        if ( this.#cronExpression ) {
            return this.#cronExpression.getSchedule( { maxItems, fromDate } );
        }

        fromDate = fromDate.toTemporalInstant();

        const dates = [];

        if ( this.#date.epochMilliseconds >= fromDate.epochMilliseconds ) {
            dates.push( new Date( this.#date.epochMilliseconds ) );
        }

        return dates;
    }

    tick () {
        this.#onTick( true );

        return this;
    }

    start () {
        if ( this.#isStarted ) return this;

        this.#lastTickDate = null;
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

        const timeout = Math.max( -1, ( this.nexTicktDate ?? -1 ) - Date.now() );

        this.#timeout = setTimeout( this.#onTick.bind( this ), timeout );

        if ( this.#unref ) this.#timeout.unref();
    }

    #clearTimeout () {
        if ( this.#timeout ) {
            clearTimeout( this.#timeout );

            this.#timeout = null;
        }
    }

    #onTick ( manual ) {
        this.#lastTickDate = new Date();
        this.#ticks++;

        var stop;

        if ( this.#maxTicks && this.#ticks >= this.#maxTicks ) stop = true;

        if ( !manual && !stop ) {
            if ( this.#date ) {
                stop = true;
            }
            else {
                this.#setTimeout();
            }
        }

        this.emit( "tick", this );

        if ( stop ) this.stop();
    }
}
