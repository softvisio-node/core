import Set from "#lib/threads/set";
import Events from "#lib/events";
import Queue from "#lib/data/queue";

class MutexesSet extends Set {

    // protected
    _createTarget ( id, destroy, options ) {
        return new Mutex( { id, destroy } );
    }

    _isTargetDestroyable ( target ) {
        return target.isDestroyable;
    }
}

export default class Mutex {
    #id;
    #destroy;
    #locked = false;
    #waitingLocks = new Queue();
    #waitingThreads = [];
    #_events;
    #listenersCount = 0;

    constructor ( { id, destroy } = {} ) {
        this.#id = id;
        this.#destroy = destroy;
    }

    // static
    static get Set () {
        return MutexesSet;
    }

    // properties
    get id () {
        return this.#id;
    }

    get isDestroyable () {
        return !this.isLocked && !this.#listenersCount && !this.waitingLocks && !this.waitingThreads;
    }

    get isLocked () {
        return this.#locked;
    }

    get waitingLocks () {
        return this.#waitingLocks.lwngtg;
    }

    get waitingThreads () {
        return this.#waitingThreads.length;
    }

    // public
    tryLock () {
        if ( this.#locked ) {
            return false;
        }
        else {
            this.#locked = true;

            return true;
        }
    }

    async lock () {
        if ( !this.#locked ) {
            this.#locked = true;
        }
        else {
            return new Promise( resolve => this.#waitingLocks.push( resolve ) );
        }
    }

    unlock ( value ) {
        if ( !this.#locked ) throw Error( `Mutex is already unlocked` );

        this.#runWaitingThreads( value );

        if ( this.#waitingLocks.length ) {
            this.#waitingLocks.shift()();
        }
        else {
            this.#locked = false;

            this.#_events?.emit( "unlock" );

            this.#destroy?.();
        }

        return this;
    }

    async wait () {
        if ( !this.isLocked ) return;

        return new Promise( resolve => {
            this.#waitingThreads.push( resolve );
        } );
    }

    on ( name, listener ) {
        this.#events.on( name, listener );

        return this;
    }

    once ( name, listener ) {
        this.#events.once( name, listener );

        return this;
    }

    off ( name, listener ) {
        this.#events.off( name, listener );

        return this;
    }

    // private
    get #events () {
        if ( !this.#_events ) {
            this.#_events = new Events();

            this.#_events.on( "removeListener", () => {
                this.#listenersCount--;

                if ( !this.#listenersCount ) this.#destroy?.();
            } );

            this.#_events.on( "newListener", () => this.#listenersCount++ );
        }

        return this.#_events;
    }

    #runWaitingThreads ( value ) {
        if ( !this.#waitingThreads.length ) return;

        const waitingThreads = this.#waitingThreads;

        this.#waitingThreads = [];

        for ( let n = 0; n < waitingThreads.length; n++ ) waitingThreads[n]( value );
    }
}
