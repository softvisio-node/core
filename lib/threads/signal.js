module.exports = class Signal {
    #wake = 0;
    #awaited = [];

    async wait () {
        if ( this.#wake ) {
            this.#wake--;
        }
        else {
            return new Promise( ( resolve ) => {
                this.#awaited.push( resolve );
            } );
        }
    }

    // wake up one thread, don't store signal if no waiting threads
    wake () {
        if ( this.#awaited.length ) {
            const cb = this.#awaited.shift();

            cb();
        }
    }

    // wake up single thread, store signal, if no waiting threads
    send () {
        if ( this.#awaited.length ) {
            const cb = this.#awaited.shift();

            cb();
        }
        else {
            this.#wake++;
        }
    }

    // wake up all waiting threads
    broadcast () {
        var awaited = this.#awaited;

        this.#awaited = [];

        for ( const cb of awaited ) {
            process.nextTick;
            cb();
        }
    }

    awaited () {
        return this.#awaited.length;
    }
};
