module.exports = class Signal {
    #sent;
    #value;
    #waitingThreads = [];

    // returns number of threads in the queue
    get waitingThreads () {
        return this.#waitingThreads.length;
    }

    send ( value ) {

        // has waiting threads
        if ( this.#waitingThreads.length ) {
            this.#waitingThreads.shift()( value );
        }

        // remember signal value
        else {
            this.#sent = true;
            this.#value = value;
        }
    }

    broadcast ( value ) {
        const waitingThreads = this.#waitingThreads;

        this.#waitingThreads = [];

        for ( const thread of waitingThreads ) thread( value );
    }

    async wait () {

        // signal already sent
        if ( this.#sent ) {
            this.#sent = false;

            const value = this.#value;

            this.#value = null;

            return value;
        }

        // wait for signal
        else {
            return new Promise( resolve => this.#waitingThreads.push( resolve ) );
        }
    }
};
