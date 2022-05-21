import Semaphore from "./semaphore.js";

class MutexSet extends Semaphore.Set {
    constructor ( { maxWaitingThreads, destroyOnFinish } = {} ) {
        super( { "maxThreads": 1, maxWaitingThreads, destroyOnFinish } );
    }

    // protected
    get _Semaphore () {
        return Mutex;
    }
}

export default class Mutex extends Semaphore {
    constructor ( { id, maxWaitingThreads, destroyOnFinish } = {} ) {
        super( { id, maxWaitingThreads, destroyOnFinish } );

        super.maxThreads = 1;
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
