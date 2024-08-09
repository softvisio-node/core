const MAX_TIMEOUT = 0x7fffffff;

class Timeout {
    #timeout;
    #ref = true;

    constructor ( callback, delay, ...args ) {
        this.#setTimeout( callback, delay, ...args );
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
    #setTimeout ( callback, delay, ...args ) {
        var date;

        if ( typeof delay === "number" ) {
            if ( delay <= MAX_TIMEOUT ) {
                return this.#setGlobalTimeout( callback, delay, ...args );
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
            this.#setGlobalTimeout( callback, delay, ...args );
        }
        else {
            this.#setGlobalTimeout( this.#setTimeout.bind( this ), MAX_TIMEOUT, callback, date, ...args );
        }
    }

    #setGlobalTimeout ( callback, delay, ...args ) {
        this.#timeout = global.setTimeout( callback, delay, ...args );

        if ( !this.#ref ) this.#timeout.unref();
    }
}

export default function setTimeout ( callback, delay, ...args ) {
    return new Timeout( callback, delay, args );
}
