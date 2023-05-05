import Semaphore from "./semaphore.js";

class MutexSet extends Semaphore.Set {

    // properties
    get Semaphore () {
        return Mutex;
    }
}

export default class Mutex extends Semaphore {
    constructor ( { id, maxWaitingThreads } = {} ) {
        super( { id, "maxThreads": 1, maxWaitingThreads } );
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
        return;
    }
}
