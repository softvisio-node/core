import CronExpression from "#lib/cron/expression";
import Events from "#lib/events";
import { setTimeout } from "#lib/timeout";

export default class Cron extends Events {
    #cronExpression;
    #maxTicks;
    #isStarted = false;
    #lastTickDate;
    #ticks = 0;
    #nexTicktDate;
    #timeout;
    #ref = true;

    constructor ( expression, { timezone, ignoreSeconds, maxTicks } = {} ) {
        super();

        this.#maxTicks = maxTicks;

        this.#cronExpression = new CronExpression( expression, { timezone, ignoreSeconds } );
    }

    // static
    static isValid ( expression, options ) {
        return CronExpression.isValid( expression, options );
    }

    // properties
    get timezone () {
        return this.#cronExpression.timezone;
    }

    get maxTicks () {
        return this.#maxTicks;
    }

    get hasRef () {
        return this.#ref;
    }

    get ignoreSeconds () {
        return this.#cronExpression.ignoreSeconds;
    }

    get hasSeconds () {
        return this.#cronExpression.hasSeconds;
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

        this.#nexTicktDate = this.getSchedule( {
            "maxItems": 1,
        } )[ 0 ];

        return this.#nexTicktDate;
    }

    // public
    toString () {
        return this.#cronExpression.toString();
    }

    toJSON () {
        return this.toString();
    }

    getSchedule ( { maxItems = 1, fromDate } = {} ) {
        return this.#cronExpression.getSchedule( { maxItems, fromDate } );
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
        this.#ref = true;

        this.#timeout?.ref();

        return this;
    }

    unref () {
        this.#ref = false;

        this.#timeout?.unref();

        return this;
    }

    // private
    #setTimeout () {
        this.#clearTimeout();

        if ( this.nexTicktDate ) {
            this.#timeout = setTimeout( this.#onTick.bind( this ), this.nexTicktDate );

            if ( !this.#ref ) this.#timeout.unref();
        }
    }

    #clearTimeout () {
        if ( this.#timeout ) {
            this.#timeout.close();

            this.#timeout = null;
        }
    }

    #onTick ( manual ) {
        this.#lastTickDate = new Date();
        this.#ticks++;

        var stop;

        if ( this.#maxTicks && this.#ticks >= this.#maxTicks ) {
            stop = true;
        }

        if ( !manual && !stop ) {
            this.#setTimeout();
        }

        this.emit( "tick", this );

        if ( stop ) this.stop();
    }
}
