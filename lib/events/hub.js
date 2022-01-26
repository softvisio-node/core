import Events from "#lib/events";

export default class EventsHub {
    #emitter = new Events();
    #watch = new Events();
    #forward = new Events();

    constructor () {
        this.#emitter.on( "newListener", name => {
            if ( name === "newListener" || name === "removeListener" ) return;

            if ( !this.#emitter.listenerCount( name ) ) this.#watch.emit( "*", name, true );
        } );

        this.#emitter.on( "removeListener", name => {
            if ( name === "newListener" || name === "removeListener" ) return;

            if ( !this.#emitter.listenerCount( name ) ) this.#watch.emit( "*", name, false );
        } );
    }

    // public
    on ( name, listener ) {
        this.#subscribe( name, listener, "on" );

        return this;
    }

    once ( name, listener ) {
        this.#subscribe( name, listener, "once" );

        return this;
    }

    off ( name, listener ) {
        this.#unsubscribe( name, listener );

        return this;
    }

    publish ( name, args ) {
        if ( name === "newListener" || name === "removeListener" ) return;

        if ( name === "*" ) return;

        this.#emitter.emit( name, ...args );

        this.#forward.emit( "*", name, args );
    }

    hasListeners ( name ) {
        return !!this.#emitter.listenerCount( name );
    }

    watch ( listener ) {
        this.#watch.on( "*", listener );

        return this;
    }

    unwatch ( listener ) {
        this.#watch.off( "*", listener );

        return this;
    }

    forwardSubscriptions ( target, { on, off, publish } = {} ) {
        const forwarders = {};

        on ||= target.on.bind( target );
        off ||= target.off.bind( target );
        publish ||= this.publish.bind( this );

        const watcher = ( name, subscribe ) => {
            if ( subscribe ) {
                forwarders[name] = ( ...args ) => publish( name, args );

                on( name, forwarders[name] );
            }
            else {
                off( name, forwarders[name] );

                delete forwarders[name];
            }
        };

        this.watch( watcher );
    }

    // private
    #subscribe ( name, listener, method ) {
        if ( name === "newListener" || name === "removeListener" ) return;

        if ( name === "*" ) {
            this.#forward[method]( "*", listener );
        }
        else {
            this.#emitter[method]( name, listener );
        }
    }

    #unsubscribe ( name, listener ) {
        if ( name === "newListener" || name === "removeListener" ) return;

        if ( name === "*" ) {
            this.#forward.off( "*", listener );
        }
        else {
            this.#emitter.off( name, listener );
        }
    }
}
