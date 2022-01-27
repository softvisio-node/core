import Events from "#lib/events";

const RESERVED = new Set( ["newListener", "removeListener", "*"] );

export default class EventsHub {
    #emitter = new Events();
    #watch = new Events();

    constructor () {
        this.#emitter.on( "newListener", name => {
            if ( RESERVED.has( name ) ) return;

            if ( !this.#emitter.listenerCount( name ) ) this.#watch.emit( "*", name, true );
        } );

        this.#emitter.on( "removeListener", name => {
            if ( RESERVED.has( name ) ) return;

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

    publish ( name, ...args ) {
        if ( RESERVED.has( name ) ) return;

        this.#emitter.emit( name, ...args );

        this.#emitter.emit( "*", name, ...args );
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

    forwardSubscriptions ( target, { on, off, listener } = {} ) {
        const forwarders = {};

        on ||= target.on.bind( target );
        off ||= target.off.bind( target );
        listener ||= this.publish.bind( this );

        const watcher = ( name, subscribe ) => {
            if ( subscribe ) {
                forwarders[name] = ( ...args ) => listener( name, ...args );

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

        this.#emitter[method]( name, listener );
    }

    #unsubscribe ( name, listener ) {
        if ( name === "newListener" || name === "removeListener" ) return;

        this.#emitter.off( name, listener );
    }
}
