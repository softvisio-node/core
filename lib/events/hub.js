import Events from "#lib/events";

const RESERVED = new Set( ["newListener", "removeListener", "*"] );

export default class EventsHub {
    #emitter = new Events();
    #watch = new Events();
    #forwards = new Map();

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

        this.#emitter.emit( "*", name, args );
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
        if ( this.#forwards.has( target ) ) throw Error( `Target already used` );

        on ||= target.on.bind( target );
        off ||= target.off.bind( target );
        listener ||= this.publish.bind( this );

        const spec = {
            off,
            listener,
            "forwarders": {},
        };

        this.#forwards.set( target, spec );

        spec.watcher = ( name, subscribe ) => {
            if ( subscribe ) {
                on( name, ( spec.forwarders[name] = ( ...args ) => listener( name, args ) ) );
            }
            else {
                off( name, spec.forwarders[name] );

                delete spec.forwarders[name];
            }
        };

        this.watch( spec.watcher );
    }

    unforwardSubscriptions ( target ) {
        const spec = this.#forwards.get( target );

        if ( !spec ) return;

        this.#forwards.delete( target );

        this.unwatch( spec.watcher );

        for ( const name in spec.forwarders ) spec.off( name, spec.forwarders[name] );
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
