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

    get timeout () {
        return cron.timeout( this.#time );
    }
}

export default class Cron extends Events {
    #cron;
    #time;

    constructor ( cronTime, { start, timezone, runOnInit, unrefTimeout } = {} ) {
        super();

        this.time = cronTime;

        var utcOffset;

        if ( typeof timezone === "number" ) {
            utcOffset = timezone;
            timezone = null;
        }

        this.#cron = cron.job( this.#time.time,
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

    static sendAt ( cronTime ) {
        if ( cronTime instanceof CronTime ) cronTime = cronTime.time;

        return cron.sendAt( cronTime );
    }

    static timeout ( cronTime ) {
        if ( cronTime instanceof CronTime ) cronTime = cronTime.time;

        return cron.timeout( cronTime );
    }

    // properties
    sendAt () {
        return Cron.sendAt( this.#time );
    }

    timeout () {
        return Cron.timeout( this.#time );
    }

    get lastDate () {
        return this.#cron.lastDate();
    }

    get nextDates () {
        return this.#cron.nextDates();
    }

    get time () {
        return this.#time;
    }

    set time ( cronTime ) {
        if ( !( cronTime instanceof CronTime ) ) cronTime = new CronTime( cronTime );

        this.#time = cronTime;

        if ( this.#cron ) this.#cron.setTime( this.#time.time );
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
