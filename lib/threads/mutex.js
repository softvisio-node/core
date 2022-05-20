import Semaphore from "./semaphore.js";

class MutexSet extends Semaphore.Set {

    // protected
    _build ( id ) {
        return new Mutex( { id } );
    }
}

class MutexSet1 extends Semaphore.Set1 {
    constructor ( { maxWaitingThreads, destroyOnDone = true } = {} ) {
        super( { "maxThreads": 1, maxWaitingThreads, destroyOnDone } );
    }

    // protected
    get _Semaphore () {
        return Mutex;
    }
}

export default class Mutex extends Semaphore {
    constructor ( options = {} ) {
        super( options );

        super.maxThreads = 1;
    }

    // static
    static get Set () {
        return MutexSet;
    }

    static get Set1 () {
        return MutexSet1;
    }

    // properties
    get maxThreads () {
        return super.maxThreads;
    }

    set maxThreads ( maxThreads ) {}
}
