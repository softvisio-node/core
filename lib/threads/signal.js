module.exports = class Signal {
    #waitingThreads = [];
    #locked = false;

    // returns number of threads in the queue
    get waitingThreads () {
        return this.#waitingThreads.length;
    }

    tryLock () {
        if ( !this.#locked ) {
            this.#locked = true;

            return true;
        }
        else return false;
    }

    lock () {
        this.#locked = true;
    }

    unlock () {
        this.#locked = false;
    }

    send ( res ) {
        if ( this.#waitingThreads.length ) this.#waitingThreads.shift()( res );
    }

    broadcast ( res ) {
        const waitingThreads = this.#waitingThreads;

        this.#waitingThreads = [];

        for ( const thread of waitingThreads ) thread( res );
    }

    async wait () {
        return new Promise( resolve => this.#waitingThreads.push( resolve ) );
    }
};
