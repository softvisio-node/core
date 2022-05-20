import Semaphore from "./semaphore.js";

class MutexSet extends Semaphore.Set1 {
    constructor ( { maxWaitingThreads, destroyOnDone } = {} ) {
        super( { "maxThreads": 1, maxWaitingThreads, destroyOnDone } );
    }

    // protected
    get _Semaphore () {
        return Mutex;
    }
}

export default class Mutex extends Semaphore {
    constructor ( { id, maxWaitingThreads } = {} ) {
        super( { id, maxWaitingThreads, "maxThreads": 1 } );
    }

    // static
    static get Set () {
        return MutexSet;
    }

    // properties
    get maxThreads () {
        return super.maxThreads;
    }

    set maxThreads ( maxThreads ) {}
}
