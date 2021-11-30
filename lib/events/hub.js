export default class EventsHub {
    #listeners = {};
    #subscribeListeners = {};

    // public
    on ( prefix, name, listener, clientId ) {
        const listeners = ( this.#listeners[prefix + ":" + name] ||= new Map() );

        if ( listeners.has( listener ) ) return;

        listeners.set( listener, clientId );

        if ( listeners.size === 1 ) this.#emit( "subscribe", prefix, name );
    }

    off ( prefix, name, listener ) {
        const listeners = this.#listeners[prefix + ":" + name];

        if ( !listeners ) return;

        listeners.delete( listener );

        if ( !listeners.size ) {
            delete this.#listeners[prefix + ":" + name];

            this.#emit( "unsubscribe", prefix, name );
        }
    }

    subscribe ( prefixes, listener ) {
        if ( !Array.isArray( prefixes ) ) prefixes = [prefixes];

        for ( const prefix of prefixes ) {
            const listeners = ( this.#subscribeListeners[prefix] ||= new Set() );

            listeners.add( listener );
        }
    }

    unsubscribe ( prefixes, listener ) {
        if ( !Array.isArray( prefixes ) ) prefixes = [prefixes];

        for ( const prefix of prefixes ) {
            const listeners = this.#subscribeListeners[prefix];

            if ( !listeners ) return;

            listeners.delete( listener );

            if ( !listeners.size ) delete this.#subscribeListeners[prefix];
        }
    }

    publish ( prefix, name, args, publisherId ) {
        const listeners = this.#listeners[prefix + ":" + name];

        if ( !listeners ) return;

        listeners.forEach( ( clientId, listener ) => {
            if ( publisherId && publisherId === clientId ) return;

            listener( name, args );
        } );
    }

    // private
    #emit ( type, prefix, name ) {
        const listeners = this.#subscribeListeners[prefix];

        if ( !listeners ) return;

        listeners.forEach( listener => listener( type, prefix, name ) );
    }
}
