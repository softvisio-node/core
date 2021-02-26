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
    #waitingThreads = [];

    get isLocked () {
        return !!this.#locked;
    }

    get waitingThreads () {
        return this.#waitingThreads.length;
    }

    // if locked - wait for unlock, lock and return
    // if unlocked - lock and return
    async lock () {
        if ( this.tryLock() ) return;

        while ( 1 ) {
            const res = await this.wait();

            if ( this.tryLock() ) return res;
        }
    }

    // if locked - returns false
    // if unlocked - lock and returns true
    tryLock () {
        if ( this.#locked ) return false;

        this.#locked = true;

        return true;
    }

    // unlock one waiting thread
    unlock ( res ) {
        if ( !this.#locked ) return;

        this.#locked = false;

        if ( this.#waitingThreads.length ) this.#waitingThreads.shift()( res );
    }

    // unlock all waiting threads
    unlockAll ( res ) {
        if ( !this.#locked ) return;

        this.#locked = false;

        const threads = this.#waitingThreads;

        this.#waitingThreads = [];

        for ( const thread of threads ) thread( res );
    }

    // if locked - wait for unlock
    // if not locked - returns immediately
    async wait () {
        if ( !this.#locked ) return;

        return new Promise( resolve => this.#waitingThreads.push( resolve ) );
    }
};
