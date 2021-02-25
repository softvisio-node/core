/* EXAMPLE:
 *
 * const mutex = new Mutex();
 *
 * if ( mutex.lock() ) runThread(); // try to lock, if success - run thread
 *
 * await mutex.wait(); // waiting for unlock, returns immediately if not locked
 *
 * mutex.unlock(); // unlock single waiting thread
 * mutex.unlockAll(); // unlock all waiting threads
 */

module.exports = class Mutex {
    #locked;
    #threads = [];

    get isLocked () {
        return !!this.#locked;
    }

    get waitingThreads () {
        return this.#threads.length;
    }

    lock () {
        if ( this.#locked ) return false;

        this.#locked = true;

        return true;
    }

    unlock ( res ) {
        if ( !this.#locked ) return;

        const thread = this.#threads.shift();

        if ( thread ) {
            thread( res );
        }
        else {
            this.#locked = false;
        }
    }

    unlockAll ( res ) {
        if ( !this.#locked ) return;

        this.#locked = false;

        const threads = this.#threads;

        this.#threads = [];

        for ( const thread of threads ) thread( res );
    }

    async wait () {
        if ( !this.#locked ) return;

        return new Promise( resolve => this.#threads.push( resolve ) );
    }
};
