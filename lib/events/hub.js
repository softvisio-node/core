export default class EventsHub {
    #listeners = {};
    #subscribeListeners = {};

    // public
    on ( name, listener, clientId ) {
        const listeners = ( this.#listeners[name] ||= new Map() );

        if ( listeners.has( listener ) ) return;

        listeners.set( listener, clientId );

        if ( listeners.size === 1 ) {
            const [prefix, name] = this.#parsePrefix( name );

            if ( prefix ) this.#emit( "subscribe", prefix, name );
        }
    }

    off ( name, listener ) {
        const listeners = this.#listeners[name];

        if ( !listeners ) return;

        listeners.delete( listener );

        if ( !listeners.size ) {
            delete this.#listeners[name];

            const [prefix, name] = this.#parsePrefix( name );

            if ( prefix ) this.#emit( "unsubscribe", prefix, name );
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

    publish ( name, args, publisherId ) {
        const listeners = this.#listeners[name];

        if ( !listeners ) return;

        listeners.forEach( ( clientId, listener ) => {
            if ( publisherId && publisherId === clientId ) return;

            listener( args );
        } );
    }

    // private
    #parsePrefix ( name ) {
        const idx = name.indexOf( ":" );

        if ( idx > 0 ) {
            return [name.substr( 0, idx ), name.substring( idx + 1 )];
        }
        else {
            return [null, name];
        }
    }

    #emit ( type, prefix, name ) {
        const listeners = this.#subscribeListeners[prefix];

        if ( !listeners ) return;

        listeners.forEach( listener => listener( type, prefix, name ) );
    }
}
