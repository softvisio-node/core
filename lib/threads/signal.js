import Events from "#lib/events";
import Deque from "#lib/data/deque";

export default class Signal {
    #sent;
    #value;
    #waitingThreads = new Deque();
    #_events;

    // properties
    get waitingThreads () {
        return this.#waitingThreads.length;
    }

    // public
    send ( value ) {

        // has waiting threads
        if ( this.#waitingThreads.length ) {
            this.#waitingThreads.shift()( value );

            this.#checkThreads();
        }

        // remember signal value
        else {
            this.#sent = true;
            this.#value = value;
        }
    }

    try ( value ) {

        // has waiting threads
        if ( this.#waitingThreads.length ) {
            this.#waitingThreads.shift()( value );

            this.#checkThreads();
        }
    }

    broadcast ( value ) {
        const waitingThreads = this.#waitingThreads;

        this.#waitingThreads = new Deque();

        for ( const thread of waitingThreads ) thread( value );

        this.#checkThreads();
    }

    async wait () {

        // signal already sent
        if ( this.#sent ) {
            this.#sent = false;

            const value = this.#value;

            this.#value = null;

            return value;
        }

        // wait for signal
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

    #checkThreads () {
        if ( this.#waitingThreads.length ) return;

        this.#events.emit( "drain" );
    }
}
