import Semaphore from "./semaphore.js";

class MutexSet extends Semaphore.Set {
    constructor ( { maxWaitingThreads, destroyOnFinish } = {} ) {
        super( { "maxThreads": 1, maxWaitingThreads, destroyOnFinish } );
    }

    get Semaphore () {
        return Mutex;
    }
}

export default class Mutex extends Semaphore {
    constructor ( { id, maxWaitingThreads, destroyOnFinish } = {} ) {
        super( { id, "maxThreads": 1, maxWaitingThreads, destroyOnFinish } );
    }

    // static
    static get Set () {
        return MutexSet;
    }

    // properties
    get maxThreads () {
        return super.maxThreads;
    }

    set maxThreads ( value ) {
        if ( this.maxThreads == null ) super.maxThreads = 1;
    }
}
