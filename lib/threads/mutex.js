import Semaphore from "./semaphore.js";

class MutexSet extends Semaphore.Set {

    // protected
    _build ( id ) {
        return new Mutex( { id } );
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

    // properties
    get maxThreads () {
        return super.maxThreads;
    }

    set maxThreads ( maxThreads ) {}
}
