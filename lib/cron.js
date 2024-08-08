import "#lib/temporal";
import CronFormat from "#lib/cron/format";
import Events from "#lib/events";

export default class Cron extends Events {
    #cronFormat;
    #date;
    #timezone;
    #maxTicks;
    #isStarted = false;
    #lastDate;
    #ticks = 0;
    #nextDate;
    #timeout;
    #unref;

    constructor ( source, { timezone, ignoreSeconds, maxTicks } = {} ) {
        super();

        this.#maxTicks = maxTicks;

        // number - milliseconds
        if ( typeof source === "number" ) {
            source = new Date( source );
        }

        // Date
        if ( source instanceof Date ) {
            this.#date = source.toTemporalInstant();
        }

        // cron
        else {
            this.#cronFormat = new CronFormat( source, { timezone, ignoreSeconds } );
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
    static isValid ( value, options ) {
        return CronFormat.isValid( value, options );
    }

    // properties
    get timeZone () {
        return this.#timezone;
    }

    get maxTicks () {
        return this.#maxTicks;
    }

    get ignoreSeconds () {
        return this.#cronFormat?.ignoreSeconds ?? false;
    }

    get useSeconds () {
        return this.#cronFormat?.useSeconds ?? false;
    }

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

        this.#nextDate = this.getSchedule( { "maxItems": 1 } )[ 0 ];

        return this.#nextDate;
    }

    get timeout () {
        return Math.max( -1, ( this.nextDate ?? -1 ) - new Date() );
    }

    // public
    toString () {
        return this.#cronFormat ? this.#cronFormat.toString() : this.#date.toISOStriing();
    }

    toJSON () {
        return this.toString();
    }

    getSchedule ( { maxItems = 1, fromDate } = {} ) {
        if ( this.#cronFormat ) {
            return this.#cronFormat.getSchedule( ( { maxItems, fromDate } = {} ) );
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
        this.#lastDate = new Date();
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
