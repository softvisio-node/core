import Set from "#lib/threads/set";
import Events from "#lib/events";
import Deque from "#lib/data/deque";

class SignalSet extends Set {

    // protected
    _createItem ( id, options ) {
        const item = new Signal( { id } );

        item.on( "finish", this._onItemFinish.bind( this, id ) );

        return item;
    }

    _isItemFinished ( item ) {
        if ( item.waitingSignals.length ) return;

        if ( item.waitingThreads.length ) return;

        return true;
    }
}

export default class Signal {
    #id;
    #waitingSignals = new Deque();
    #waitingThreads = new Deque();
    #_events;

    constructor ( { id } = {} ) {
        this.#id = id;
    }

    // static
    static get Set () {
        return SignalSet;
    }

    // properties
    get id () {
        return this.#id;
    }

    get waitingSignals () {
        return this.#waitingSignals.length;
    }

    get waitingThreads () {
        return this.#waitingThreads.length;
    }

    // public
    send ( value ) {
        if ( !this.#trySend( value ) ) {
            if ( this.#waitingSignals.length ) this.#waitingSignals = new Deque();

            this.#waitingSignals.push( value );
        }

        return this;
    }

    push ( value ) {
        if ( !this.#trySend( value ) ) this.#waitingSignals.push( value );

        return this;
    }

    unshift ( value ) {
        if ( !this.#trySend( value ) ) this.#waitingSignals.unshift( value );

        return this;
    }

    trySend ( value ) {
        this.#trySend( value );

        return this;
    }

    broadcast ( value ) {
        const waitingThreads = this.#waitingThreads;

        this.#waitingThreads = new Deque();

        for ( const thread of waitingThreads ) thread( value );

        this.#checkFinish();

        return this;
    }

    async wait () {
        if ( this.#waitingSignals.length ) {
            const value = this.#waitingSignals.shift();

            this.#checkFinish();

            return value;
        }
        else {
            return new Promise( resolve => this.#waitingThreads.push( resolve ) );
        }
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

    #trySend ( value ) {
        if ( !this.#waitingThreads.length ) return;

        this.#waitingThreads.shift()( value );

        this.#checkFinish();

        return true;
    }

    #checkFinish () {
        if ( this.#waitingSignals.length ) return;

        if ( this.#waitingThreads.length ) return;

        this.#_events?.emit( "finish" );
    }
}
