import isBrowser from "#lib/is-browser";

const MAX_TIMEOUT = 0x7fffffff;

export default class Timeout {
    #callback;
    #signal;
    #signalListener;
    #timeout;
    #ref = true;

    constructor ( delay, callback, { signal } = {} ) {
        if ( delay instanceof Date ) {
            delay = new Date( delay );
        }

        if ( !signal?.aborted ) {
            this.#callback = callback;

            if ( signal ) {
                this.#signal = signal;

                this.#signalListener = this.#clear.bind( this );

                signal.addEventListener( "abort", this.#signalListener );
            }

            this.#setTimeout( delay || 0 );
        }
    }

    // properties
    hasRef () {
        return this.#ref;
    }

    // public
    close () {
        this.#clear();

        return this;
    }

    ref () {
        this.#ref = true;

        this.#timeout.ref();

        return this;
    }

    unref () {
        this.#ref = false;

        this.#timeout.unref();

        return this;
    }

    // private
    #clear () {
        this.#callback = null;

        clearTimeout( this.#timeout );

        this.#timeout = null;

        if ( this.#signal ) {
            this.#signal.removeEventListener( "abort", this.#signalListener );

            this.#signalListener = null;

            this.#signal = null;
        }
    }

    #done () {
        const callback = this.#callback;

        this.#clear();

        callback();
    }

    #setTimeout ( delay ) {
        var date;

        if ( typeof delay === "number" ) {
            if ( delay <= MAX_TIMEOUT ) {
                return this.#setGlobalTimeout( this.#done.bind( this ), delay );
            }
            else {
                date = new Date( Date.now() + delay );
            }
        }
        else {
            date = delay;
        }

        delay = date - Date.now();

        if ( delay <= MAX_TIMEOUT ) {
            this.#setGlobalTimeout( this.#done.bind( this ), delay );
        }
        else {
            this.#setGlobalTimeout( this.#setTimeout.bind( this, date ), MAX_TIMEOUT );
        }
    }

    #setGlobalTimeout ( callback, delay ) {

        // browser
        if ( isBrowser ) {
            this.#timeout = window.setTimeout( callback, delay );
        }

        // node
        else {
            this.#timeout = global.setTimeout( callback, delay );
        }

        if ( !this.#ref ) this.#timeout.unref();
    }
}

export function setTimeout ( callback, delay, ...args ) {
    return new Timeout( delay, function () {
        callback( ...args );
    } );
}

export async function sleep ( delay, signal ) {
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

            timeout = setTimeout( onDone, delay );
        } );
    }
    else {
        return new Promise( resolve => setTimeout( resolve, delay ) );
    }
}
