import Events from "#lib/events";
import cron from "cron";

// cronTime, onTick, onComplete, start, timezone, context, runOnInit, utcOffset, unrefTimeout

class CronTime {
    #time;

    constructor ( cronTime ) {
        this.#time = new cron.time( cronTime );
    }

    // properties
    get time () {
        return this.#time;
    }

    get nextTick () {
        return cron.sendAt( this.#time );
    }

    get nextTickTimeout () {
        return cron.timeout( this.#time );
    }
}

export default class Cron extends Events {
    #cron;

    constructor ( cronTime, { start, timezone, runOnInit, unrefTimeout } = {} ) {
        super();

        var utcOffset;

        if ( typeof timezone === "number" ) {
            utcOffset = timezone;
            timezone = null;
        }

        this.#cron = cron.job( cronTime,
            () => this.emit( "tick" ),
            () => this.emit( "complete" ),
            null,
            timezone,
            null,
            runOnInit,
            utcOffset,
            unrefTimeout );
    }

    // static
    static get CronTime () {
        return CronTime;
    }

    static nextTick ( cronTime ) {
        if ( cronTime instanceof CronTime ) cronTime = cronTime.time;

        return cron.sendAt( cronTime );
    }

    static nextTickTimeout ( cronTime ) {
        if ( cronTime instanceof CronTime ) cronTime = cronTime.time;

        return cron.timeout( cronTime );
    }

    // properties
    get lastDate () {
        return this.#cron.lastDate();
    }

    get nextDates () {
        return this.#cron.nextDates();
    }

    set time ( cronTime ) {
        if ( cronTime instanceof CronTime ) cronTime = cronTime.time;

        this.#cron.setTime( cronTime );
    }

    // public
    start () {
        this.#cron.start();

        return this;
    }

    stop () {
        this.#cron.stop();

        return this;
    }
}
