const RESERVED = new Set( ["subscribe", "unsubscribe"] );

export default class EventsHub {
    #events = {};

    // public
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

    publish ( name, args ) {
        const listeners = this.#events[name];

        if ( !listeners ) return;

        listeners.forEach( listener => listener( args ) );
    }
}
