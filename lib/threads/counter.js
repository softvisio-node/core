import Set from "#lib/threads/set";
import Events from "#lib/events";

class CountersSet extends Set {

    // protected
    _createTarget ( id, options ) {
        const destroy = this._destroyTarget.bind( this, id );

        const target = new Counter( { ...options, id, destroy } );

        return target;
    }

    _isTargetDestroyable ( target ) {
        return target.isDestroyable;
    }
}

export default class Counter {
    #id;
    #destroy;
    #value = 0;
    #waitingThreads = [];
    #_events;

    constructor ( { id, destroy, value } = {} ) {
        this.#id = id;
        this.#destroy = destroy;
        if ( value ) this.#setValue( value );
    }

    // static
    static get Set () {
        return CountersSet;
    }

    // properties
    get id () {
        return this.#id;
    }

    // XXX listeners count
    get isDestroyable () {
        return this.isFinished && !this.waitingThreads;
    }

    get value () {
        return this.#value;
    }

    set value ( value ) {
        this.#setValue( value );
    }

    get isFinished () {
        return !this.#value;
    }

    get waitingThreads () {
        return this.#waitingThreads.length;
    }

    // public
    inc ( value = 1 ) {
        this.#setValue( this.#value + value );

        return this;
    }

    dec ( value = 1 ) {
        this.#setValue( this.#value - value );

        return this;
    }

    async wait () {
        if ( !this.#value ) return;

        return new Promise( resolve => this.#waitingThreads.push( resolve ) );
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

    #setValue ( value ) {
        if ( !Number.isInteger( value ) ) throw TypeError( `Semaphore value must be integer` );

        if ( this.#value === value ) return;

        this.#value = value;

        if ( !this.#value ) {
            this.#runWaitingThreads();

            this.#_events?.emit( "finish" );

            if ( this.isDestroyable ) this.#destroy?.();
        }
    }

    #runWaitingThreads ( value ) {
        if ( !this.#waitingThreads.length ) return;

        const waitingThreads = this.#waitingThreads;

        this.#waitingThreads = [];

        for ( let n = 0; n < waitingThreads.length; n++ ) waitingThreads[n]( value );
    }
}
