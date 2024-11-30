import Interval from "#lib/interval";
import isBrowser from "#lib/is-browser";

const MAX_TIMEOUT = 0x7F_FF_FF_FF;

export class Timeout {
    #delay;
    #callback;
    #repeat;
    #signal;
    #iteration = 0;
    #signalListener;
    #timeout;
    #ref = true;
    #isAborted = false;

    constructor ( delay, callback, { repeat, signal } = {} ) {
        this.#repeat = repeat;

        // date
        if ( delay instanceof Date ) {

            // copy date
            delay = new Date( delay );

            this.#repeat = null;
        }

        // interval
        else if ( typeof delay === "string" ) {
            delay = new Interval( delay ).toMilliseconds();
        }

        // interval
        else if ( delay instanceof Interval ) {
            delay = delay.toMilliseconds();
        }

        this.#delay = delay || 0;

        if ( !signal?.aborted ) {
            this.#callback = callback;

            if ( signal ) {
                this.#signal = signal;

                this.#signalListener = this.#onAbort.bind( this );

                signal.addEventListener( "abort", this.#signalListener );
            }

            // signal aborted
            if ( signal?.aborted ) {
                this.#onAbort();
            }

            // start timer
            else {
                this.#setTimeout( this.#delay );
            }
        }
    }

    // properties
    get isAborted () {
        return this.#isAborted;
    }

    get repeat () {
        return this.#repeat;
    }

    get iteration () {
        return this.#iteration;
    }

    hasRef () {
        return this.#ref;
    }

    // public
    clear () {
        this.#clear();

        return this;
    }

    ref () {
        this.#ref = true;

        if ( !isBrowser ) {
            this.#timeout?.ref();
        }

        return this;
    }

    unref () {
        this.#ref = false;

        if ( !isBrowser ) {
            this.#timeout?.unref();
        }

        return this;
    }

    // private
    #clear () {
        this.#callback = null;

        this.#clearTimeout();

        if ( this.#signal ) {
            this.#signal.removeEventListener( "abort", this.#signalListener );

            this.#signalListener = null;

            this.#signal = null;
        }
    }

    #clearTimeout () {
        if ( this.#timeout ) {
            clearTimeout( this.#timeout );

            this.#timeout = null;
        }
    }

    #setTimeout ( delay ) {
        this.#iteration++;

        var date;

        // number
        if ( typeof delay === "number" ) {
            if ( delay <= MAX_TIMEOUT ) {
                return this.#setGlobalTimeout( delay, this.#onDone.bind( this ) );
            }
            else {
                date = new Date( Date.now() + delay );
            }
        }

        // date
        else {
            date = delay;
        }

        delay = date - Date.now();

        if ( delay <= MAX_TIMEOUT ) {
            this.#setGlobalTimeout( delay, this.#onDone.bind( this ) );
        }
        else {
            this.#setGlobalTimeout( MAX_TIMEOUT, this.#setTimeout.bind( this, date ) );
        }
    }

    #setGlobalTimeout ( delay, callback ) {

        // browser
        if ( isBrowser ) {
            this.#timeout = window.setTimeout( callback, delay );
        }

        // node
        else {
            this.#timeout = global.setTimeout( callback, delay );

            if ( !this.#ref ) this.#timeout.unref();
        }
    }

    #onAbort () {
        this.#isAborted = true;

        this.#clear();
    }

    #onDone () {
        const callback = this.#callback;

        if ( this.#repeat ) {
            if ( this.#repeat - this.#iteration > 0 ) {
                this.#clearTimeout();

                this.#setTimeout( this.#delay );

                callback();

                this.#iteration++;

                return;
            }
        }

        this.#clear();

        callback();
    }
}

export async function sleep ( delay, { signal } = {} ) {
    if ( signal ) {
        if ( signal.aborted ) return;

        return new Promise( resolve => {
            var timeout;

            const onDone = () => {
                timeout?.clear();

                signal.removeEventListener( "abort", onDone );

                resolve();
            };

            signal.addEventListener( "abort", onDone );

            timeout = new Timeout( delay, onDone );
        } );
    }
    else {
        return new Promise( resolve => new Timeout( delay, resolve ) );
    }
}
