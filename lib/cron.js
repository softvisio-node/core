import Events from "#lib/events";
import cron from "cron";

export default class Cron extends Events {
    #time;
    #cron;
    #timezone;
    #tickOnStart;
    #unref;
    #started = false;

    constructor ( cronTime, { timezone, tickOnStart, unref } = {} ) {
        super();

        this.#time = cronTime;
        this.#timezone = timezone;
        this.#tickOnStart = tickOnStart;
        this.#unref = unref;
    }

    // properties
    get time () {
        return this.#time;
    }

    set time ( cronTime ) {
        this.#time = cronTime;

        if ( this.#cron ) {
            this.#cron.setTime( cron.time( cronTime ) );

            if ( this.#started ) {
                this.#started = false;

                this.start();
            }
        }
    }

    get isStarted () {
        return this.#started;
    }

    get lastDate () {
        if ( !this.#cron ) return null;

        return this.#cron.lastDate();
    }

    get nextDate () {
        if ( !this.#cron ) return cron.sendAt( this.#time );
        else return this.#cron.nextDates();
    }

    get timeout () {
        return cron.timeout( this.#time );
    }

    // public
    toString () {
        return this.#time;
    }

    toJSON () {
        return this.#time;
    }

    start () {
        if ( this.#started ) return this;

        this.#started = true;

        if ( !this.#cron ) {
            var timezone = this.#timezone,
                utcOffset;

            if ( typeof timezone === "number" ) {
                utcOffset = timezone;
                timezone = null;
            }

            this.#cron = cron.job( this.#time, () => this.emit( "tick" ), null, null, timezone, null, this.#tickOnStart, utcOffset, this.#unref );
        }

        this.#cron.start();

        return this;
    }

    stop () {
        if ( this.#started ) {
            this.#started = false;

            this.#cron.stop();

            this.emit( "stop" );
        }

        return this;
    }
}
