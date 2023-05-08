import Set from "#lib/threads/set";
import Events from "#lib/events";
import Queue from "#lib/data/queue";

class MutexesSet extends Set {

    // protected
    _createTarget ( id, options ) {
        const target = new Mutex( { id } );

        target.on( "unlock", this._destroyTarget.bind( this, id ) );

        return target;
    }

    _isTargetDestroyable ( target ) {
        return !target.isLocked && !target.waitingLocks && !target.waitingThreads;
    }
}

export default class Mutex {
    #id;
    #locked = false;
    #_events;
    #waitingLocks = new Queue();
    #waitingThreads = [];

    constructor ( { id } = {} ) {
        this.#id = id;
    }

    // static
    static get Set () {
        return MutexesSet;
    }

    // properties
    get id () {
        return this.#id;
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
    async lock () {
        if ( !this.#locked ) {
            this.#locked = true;
        }
        else {
            return new Promise( resolve => {
                this.#waitingLocks.push( resolve );
            } );
        }
    }

    tryLock () {
        if ( this.#locked ) {
            return false;
        }
        else {
            this.#locked = true;

            return true;
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
        return ( this.#_events ??= new Events() );
    }

    #runWaitingThreads ( value ) {
        if ( !this.#waitingThreads.length ) return;

        const waitingThreads = this.#waitingThreads;

        this.#waitingThreads = [];

        for ( let n = 0; n < waitingThreads.length; n++ ) waitingThreads[n]( value );
    }
}
