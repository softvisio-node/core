module.exports = class Signal {
    #waitingThreads = [];

    // returns number of threads in the queue
    get waitingThreads () {
        return this.#waitingThreads.length;
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
