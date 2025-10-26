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
    #isDone = false;
    #isAborted = false;

    constructor ( delay, callback, { repeat, signal } = {} ) {
        this.#repeat = repeat;

        // date
        if ( delay instanceof Date ) {
            this.#repeat = null;

            delay = delay - Date.now();
        }

        // interval string
        else if ( typeof delay === "string" ) {
            delay = new Interval( delay ).toMilliseconds();
        }

        // interval instance
        else if ( delay instanceof Interval ) {
            delay = delay.toMilliseconds();
        }

        if ( delay > MAX_TIMEOUT ) {
            delay = new Date( Date.now() + delay );
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

            // start iteration
            else if ( !this.#repeat || this.#repeat > 0 ) {
                this.#setTimeout( this.#delay );
            }
        }
    }

    // properties
    get isAborted () {
        return this.#isAborted;
    }

    get isDone () {
        return this.#isDone;
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
        this.#isDone = true;

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
        this.#clearTimeout();

        // number
        if ( typeof delay === "number" ) {
            this.#setGlobalTimeout( delay, this.#onDone.bind( this ) );
        }

        // date
        else {
            const timeout = delay - Date.now();

            if ( timeout > MAX_TIMEOUT ) {
                this.#setGlobalTimeout( MAX_TIMEOUT, this.#setTimeout.bind( this, delay ) );
            }
            else {
                this.#setGlobalTimeout( timeout, this.#onDone.bind( this ) );
            }
        }
    }

    #setGlobalTimeout ( delay, callback ) {

        // browser
        if ( isBrowser ) {
            this.#timeout = globalThis.setTimeout( callback, delay );
        }

        // node
        else {
            this.#timeout = globalThis.setTimeout( callback, delay );

            if ( !this.#ref ) this.#timeout.unref();
        }
    }

    #onAbort () {
        this.#isAborted = true;

        this.#clear();
    }

    #onDone () {
        this.#iteration += 1;

        const callback = this.#callback;

        // next iteration
        if ( this.#repeat && this.#repeat - this.#iteration > 0 ) {
            this.#setTimeout( this.#delay );
        }

        // done
        else {
            this.#clear();
        }

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
