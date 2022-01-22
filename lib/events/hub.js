import Events from "#lib/events";

export default class EventsHub {
    #watch = new Events();
    #forward = new Events();
    #queues = {};
    #links = new Map();

    // public
    on ( queue, name, listener ) {
        this.#subscribe( queue, name, listener, false );
    }

    off ( queue, name, listener ) {
        this.#unsubscribe( queue, name, listener );
    }

    once ( queue, name, listener ) {
        this.#subscribe( queue, name, listener, true );
    }

    watch ( queue, listener ) {
        this.#watch.on( queue, listener );
    }

    unwatch ( queue, listener ) {
        this.#watch.off( queue, listener );
    }

    forward ( queue, listener ) {
        this.#forward.on( queue, listener );
    }

    unforward ( queue, listener ) {
        this.#forward.off( queue, listener );
    }

    publish ( queue, name, args ) {
        const listeners = this.#queues[queue]?.get( name );

        if ( listeners ) {
            for ( const [listener, once] of listeners.entries() ) {
                listener( ...args );

                if ( once ) this.#unsubscribe( queue, name, listener );
            }
        }

        this.#forward.emit( queue, name, args );
    }

    hasListeners ( queue, name ) {
        return !!this.#queues[queue]?.get( name )?.size;
    }

    // private
    #subscribe ( queue, name, listener, once ) {
        const events = ( this.#queues[queue] ??= new Map() );

        var listeners = events.get( name );
        if ( !listeners ) {
            listeners = new Map();
            events.set( name, listeners );
        }

        if ( listeners.has( listener ) ) return;

        listeners.set( listener, once );

        if ( listeners.size === 1 ) this.#watch.emit( queue, "subscribe", queue, name );
    }

    #unsubscribe ( queue, name, listener ) {
        const events = this.#queues[queue];
        if ( !events ) return;

        const listeners = events.get( name );
        if ( !listeners ) return;

        listeners.delete( listener );

        if ( !listeners.size ) {
            events.delete( name );
            this.#watch.emit( queue, "unsubscribe", queue, name );
        }

        if ( !events.size ) delete this.#queues[queue];
    }
}
