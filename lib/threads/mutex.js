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

const Semaphore = require( "./semaphore" );

module.exports = class Mutex extends Semaphore {
    constructor ( options = {} ) {
        super( options );

        super.maxThreads = 1;
    }

    get maxThreads () {
        return super.maxThreads;
    }

    set maxThreads ( maxThreads ) {}

    // returns max queue length
    get maxWaitingThreads () {
        return super.maxWaitingThreads;
    }

    set maxWaitingThreads ( maxWaitingThreads ) {}
};
