import Set from "#lib/threads/set";
import Events from "#lib/events";
import Deque from "#lib/data/deque";

class SignalsSet extends Set {

    // protected
    _createTarget ( id, options ) {
        const target = new Signal( { id } );

        target.on( "empty", this._destroyTarget.bind( this, id ) );

        return target;
    }

    _isTargetDestroyable ( target ) {
        return !target.hasSignal && !target.waitingThreads.length;
    }
}

export default class Signal {
    #id;
    #hasSignal = false;
    #value;
    #waitingThreads = new Deque();
    #_events;

    constructor ( { id } = {} ) {
        this.#id = id;
    }

    // static
    static get Set () {
        return SignalsSet;
    }

    // properties
    get id () {
        return this.#id;
    }

    get hasSignal () {
        return this.#hasSignal;
    }

    get value () {
        return this.#value;
    }

    get waitingThreads () {
        return this.#waitingThreads.length;
    }

    // public
    send ( value ) {
        const wasEmpty = this.#clearSignal();

        if ( this.#waitingThreads.length ) {
            this.#waitingThreads.shift()( value );

            this.#checkEmppty( wasEmpty );
        }
        else {

            // store signal
            this.#hasSignal = true;
            this.#value = value;
        }

        return this;
    }

    trySend ( value ) {
        const wasEmpty = this.#clearSignal();

        if ( this.#waitingThreads.length ) {
            this.#waitingThreads.shift()( value );
        }

        this.#checkEmppty( wasEmpty );

        return this;
    }

    broadcast ( value ) {
        const wasEmpty = this.#clearSignal();

        if ( this.#waitingThreads.length ) {
            const waitingThreads = this.#waitingThreads;
            this.#waitingThreads = new Deque();

            for ( const thread of waitingThreads ) thread( value );
        }

        this.#checkEmppty( wasEmpty );

        return this;
    }

    async wait () {
        if ( this.hasSignal ) {
            const value = this.#value;

            const wasEmpty = this.#clearSignal();

            this.#checkEmppty( wasEmpty );

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

    #clearSignal () {
        const wasEmpty = !this.#hasSignal && !this.#waitingThreads.length;

        this.#hasSignal = false;
        this.#value = undefined;

        return wasEmpty;
    }

    #checkEmppty ( wasEmpty ) {
        if ( wasEmpty || this.#hasSignal || this.#waitingThreads.length ) return;

        this.#_events?.emit( "empty" );
    }
}
