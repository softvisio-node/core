import Events from "#lib/events";

export default class EventsHub {
    #listeners = {};
    #watch = new Events();
    #forward = new Events();

    // public
    on ( name, listener ) {
        this.#subscribe( name, listener );

        return this;
    }

    once ( name, listener ) {
        this.#subscribe( name, listener, { "once": true } );

        return this;
    }

    off ( name, listener ) {
        this.#unsubscribe( name, listener );

        return this;
    }

    watch ( listener ) {
        this.#watch.on( "subscribe", listener );
        this.#watch.on( "unsubscribe", listener );

        return this;
    }

    unwatch ( listener ) {
        this.#watch.off( "subscribe", listener );
        this.#watch.off( "unsubscribe", listener );

        return this;
    }

    publish ( name, args ) {
        const listeners = this.#listeners[name];

        var published = 0;

        if ( listeners ) {
            for ( const [listener, options] of listeners.entries() ) {
                published++;

                listener( ...args );

                if ( options?.once ) this.#unsubscribe( name, listener );
            }
        }

        this.#forward.emit( "forward", name, args );

        return published;
    }

    hasListeners ( name ) {
        return !!this.#listeners[name]?.size;
    }

    forwardSubscriptions ( target, { on, off, publish } = {} ) {
        const listeners = {};

        on ||= target.on.bind( target );
        off ||= target.off.bind( target );
        publish ||= this.publish.bind( this );

        const forwarder = ( name, subscribe ) => {
            if ( subscribe ) {
                listeners[name] = ( ...args ) => publish( name, args );

                on( name, listeners[name] );
            }
            else {
                off( name, listeners[name] );

                delete listeners[name];
            }
        };

        this.watch( forwarder );
    }

    // private
    #subscribe ( name, listener, options ) {
        if ( name === "*" ) return this.#forward[options?.once ? "once" : "on"]( "forward", listener );

        const listeners = ( this.#listeners[name] ||= new Map() );

        if ( listeners.has( listener ) ) return;

        listeners.set( listener, options );

        if ( listeners.size === 1 ) this.#watch.emit( "subscribe", name, true );
    }

    #unsubscribe ( name, listener ) {
        if ( name === "*" ) return this.#forward.off( "forward", listener );

        const listeners = this.#listeners[name];

        if ( !listeners ) return;

        listeners.delete( listener );

        if ( !listeners.size ) {
            delete this.#listeners[name];
            this.#watch.emit( "unsubscribe", name, false );
        }
    }
}
