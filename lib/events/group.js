import Events from "events";

const RESERVED_NAMES = new Set( ["newListener", "removeListener"] );

export default class EventsListenersGroup {
    #sourceEvents;
    #events = new Events();
    #listeners = {};

    constructor ( sourceEvents ) {
        this.#sourceEvents = sourceEvents;

        this.#events.on( "removeListener", this.#removeListener.bind( this ) );

        this.#events.on( "newListener", this.#newListener.bind( this ) );
    }

    // public
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

    removeAllListeners ( name ) {
        this.#events.removeAllListeners( name );

        return this;
    }

    // private
    #newListener ( name ) {
        if ( this.#listeners[name] ) return;

        this.#listeners[name] = this.#events.emit.bind( this.#events, name );

        this.#sourceEvents.on( name, this.#listeners[name] );
    }

    #removeListener ( name ) {
        if ( this.#events.listenerCount( name ) > ( RESERVED_NAMES.has( name ) ? 1 : 0 ) ) return;

        this.#sourceEvents.off( name, this.#listeners[name] );

        delete this.#listeners[name];
    }
}
