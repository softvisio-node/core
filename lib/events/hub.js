const RESERVED = new Set( ["subscribe", "unsubscribe"] );

export default class EventsHub {
    #events = {};

    // XXX split events by prefixes
    // XXX method to return events names by prefix

    // public
    // XXX store client id with the listener
    on ( name, listener ) {
        const listeners = ( this.#events[name] ||= new Set() );

        if ( listeners.has( listener ) ) return;

        listeners.add( listener );

        if ( listeners.size === 1 && !RESERVED.has( name ) ) this.publish( "subscribe", name );
    }

    off ( name, listener ) {
        const listeners = this.#events[name];

        if ( !listeners || !listeners.has( listener ) ) return;

        listeners.delete( listener );

        if ( !listeners.size ) {
            delete this.#events[name];

            if ( !RESERVED.has( name ) ) this.publish( "unsubscribe", name );
        }
    }

    // XXX check client id before publish
    publish ( name, args ) {
        const listeners = this.#events[name];

        if ( !listeners ) return;

        listeners.forEach( listener => listener( args ) );
    }
}
