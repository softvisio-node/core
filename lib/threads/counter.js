import Set from "#lib/threads/set";
import Events from "#lib/events";

class CounterSet extends Set {

    // protected
    _createItem ( id, options ) {
        const item = new Counter( { id } );

        item.on( "unlock", this._checkFinished.bind( this, id ) );

        return item;
    }

    _isFinished ( item ) {
        return !item.isLocked && !item.waitingThreads;
    }
}

export default class Counter {
    #id;
    #value = 0;
    #events = new Events();
    #waitingThreads = [];

    constructor ( { id } = {} ) {
        this.#id = id;
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

    get isLocked () {
        return this.#value !== 0;
    }

    get waitingThreads () {
        return this.#waitingThreads.length;
    }

    // public
    up () {
        this.#setValue( this.#value + 1 );

        return this;
    }

    down () {
        this.#setValue( this.#value - 1 );

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
    #setValue ( value ) {
        if ( !Number.isInteger( value ) ) throw TypeError( `Semaphore value must be integer` );

        if ( this.#value === value ) return;

        this.#value = value;

        if ( !this.#value ) {
            this.#runWaitingThreads();

            this.#events.emit( "unlock" );
        }
    }

    #runWaitingThreads () {
        if ( !this.#waitingThreads.length ) return;

        const waitingThreads = this.#waitingThreads;

        this.#waitingThreads = [];

        for ( let n = 0; n < waitingThreads.length; n++ ) waitingThreads[n]();
    }
}
