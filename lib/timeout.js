const MAX_TIMEOUT = 0x7fffffff;

export class Timeout {
    #timeout;
    #ref = true;

    constructor ( callback, { delay } = {} ) {
        delay ||= 0;

        this.#setTimeout( callback, delay );
    }

    // properties
    hasRef () {
        return this.#ref;
    }

    // public
    clear () {
        clearTimeout( this.#timeout );

        this.#timeout = null;
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
    #setTimeout ( callback, delay ) {
        var date;

        if ( typeof delay === "number" ) {
            if ( delay <= MAX_TIMEOUT ) {
                return this.#setGlobalTimeout( callback, delay );
            }
            else {
                date = new Date( Date.now() + delay );
            }
        }
        else {
            date = new Date( delay );
        }

        delay = date - Date.now();

        if ( delay <= MAX_TIMEOUT ) {
            this.#setGlobalTimeout( callback, delay );
        }
        else {
            this.#setGlobalTimeout( this.#setTimeout.bind( this, callback, date ), MAX_TIMEOUT );
        }
    }

    #setGlobalTimeout ( callback, delay ) {
        this.#timeout = global.setTimeout( callback, delay );

        if ( !this.#ref ) this.#timeout.unref();
    }
}

export function setTimeout ( callback, delay, ...args ) {
    return new Timeout(
        function () {
            callback( ...args );
        },
        {
            delay,
        }
    );
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
