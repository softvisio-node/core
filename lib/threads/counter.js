import Set from "#lib/threads/set";
import Events from "#lib/events";

class CounterSet extends Set {

    // protected
    _createTarget ( id, options ) {
        const item = new Counter( { ...options, id } );

        item.on( "finish", this._onItemFinish.bind( this, id ) );

        return item;
    }

    _isTargetDestroyable ( item ) {
        return item.isFinished && !item.waitingThreads;
    }
}

export default class Counter {
    #id;
    #value = 0;
    #waitingThreads = [];
    #_events;

    constructor ( { id, value } = {} ) {
        this.#id = id;
        if ( value ) this.#setValue( value );
    }

    // static
    static get Set () {
        return CounterSet;
    }

    // properties
    get id () {
        return this.#id;
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
        }
    }

    #runWaitingThreads ( value ) {
        if ( !this.#waitingThreads.length ) return;

        const waitingThreads = this.#waitingThreads;

        this.#waitingThreads = [];

        for ( let n = 0; n < waitingThreads.length; n++ ) waitingThreads[n]( value );
    }
}
