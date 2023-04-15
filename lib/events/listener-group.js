import Events from "#lib/events";

const RESERVED_NAMES = new Set( ["newListener", "removeListener"] );

export default class EventsListenerGroup {
    #sourceEvents;
    #events = new Events();
    #listeners = {};

    constructor ( sourceEvents ) {
        this.#sourceEvents = sourceEvents;

        this.#events.on( "removeListener", this.#onRemoveListener.bind( this ) );

        this.#events.on( "newListener", this.#onNewListener.bind( this ) );
    }

    // public
    on ( name, listener ) {
        if ( RESERVED_NAMES.has( name ) ) throw `Event name ${name} is not supported`;

        this.#events.on( name, listener );

        return this;
    }

    once ( name, listener ) {
        if ( RESERVED_NAMES.has( name ) ) throw `Event name ${name} is not supported`;

        this.#events.once( name, listener );

        return this;
    }

    off ( name, listener ) {
        if ( RESERVED_NAMES.has( name ) ) throw `Event name ${name} is not supported`;

        this.#events.off( name, listener );

        return this;
    }

    clear ( name ) {
        if ( RESERVED_NAMES.has( name ) ) throw `Event name ${name} is not supported`;

        this.#events.removeAllListeners( name );

        return this;
    }

    // private
    #onNewListener ( name ) {
        if ( this.#listeners[name] ) return;

        this.#listeners[name] = this.#events.emit.bind( this.#events, name );

        this.#sourceEvents.on( name, this.#listeners[name] );
    }

    #onRemoveListener ( name ) {
        if ( this.#events.listenerCount( name ) ) return;

        this.#sourceEvents.off( name, this.#listeners[name] );

        delete this.#listeners[name];
    }
}
