const DEFAULT_MAX_LISTENERS = 10;

export default class Events {
    #maxListeners;
    #totalListeners = 0;
    #events = {};
    #watchers = new Set();
    #targets = new Map();

    constructor ( { maxListeners } = {} ) {
        this.#maxListeners = maxListeners || DEFAULT_MAX_LISTENERS;
    }

    // properties
    get maxListeners () {
        return this.#maxListeners;
    }

    set maxListeners ( value ) {
        this.#maxListeners = value;
    }

    // public
    on ( name, listener ) {
        this.#subscribe( name, listener, false );

        return this;
    }

    once ( name, listener ) {
        this.#subscribe( name, listener, true );

        return this;
    }

    off ( name, listener ) {
        this.#unsubscribe( name, listener );

        return this;
    }

    offAll ( name ) {
        if ( name ) {
            if ( this.#events[name] ) {
                for ( const listener of this.#events[name].keys() ) {
                    this.#unsubscribe( name, listener );
                }
            }
        }
        else {
            for ( const name of Object.keys( this.#events ) ) {
                for ( const listener of this.#events[name].keys() ) {
                    this.#unsubscribe( name, listener );
                }
            }
        }
    }

    emit ( name, ...args ) {
        if ( this.#events[name] ) {
            for ( const [listener, once] of this.#events[name].entries() ) {
                listener( ...args );

                if ( once ) this.#unsubscribe( name, listener );
            }
        }

        return this;
    }

    listenerCount ( name ) {
        if ( name ) {
            return this.#events[name]?.size || 0;
        }
        else {
            return this.#totalListeners;
        }
    }

    watch ( listener ) {
        this.#watchers.add( listener );

        return this;
    }

    unwatch ( listener ) {
        this.#watchers.delete( listener );

        return this;
    }

    unwatchAll () {
        this.#watchers = new Set();

        return this;
    }

    link ( target, { on, forwarder } = {} ) {

        // already linked
        if ( this.#targets.has( target ) ) this.unlink( target );

        on ||= name => name;
        forwarder ||= ( name, args ) => this.emit( name, ...args );

        const spec = {
            "names": {},
            "watcher": ( name, subscribe ) => {

                // subscribe
                if ( subscribe ) {
                    const remoteName = on( name );

                    // do not subscribe
                    if ( !remoteName ) return;

                    // subscribe
                    const listener = ( ...args ) => forwarder( name, args );

                    spec.names[name] = [remoteName, listener];

                    target.on( ...spec.names[name] );
                }

                // unsubscribe
                else if ( !spec.names[name] ) {
                    target.off( ...spec.names[name] );

                    delete spec.names[name];
                }
            },
        };

        this.#targets.set( target, spec );

        for ( const name of Object.keys( this.#events ) ) {
            spec.watcher( name, true );
        }

        this.watch( spec.watcher );

        return this;
    }

    unlink ( target ) {
        this.#unlink( target );

        return this;
    }

    unlinkAll () {
        for ( const target of this.#targets.keys() ) {
            this.#unlink( target );
        }

        return this;
    }

    // private
    #subscribe ( name, listener, once ) {
        this.#events[name] ||= new Map();

        // replace listener
        if ( this.#events[name].has( listener ) ) {
            this.#events[name].set( listener, once );
        }

        // add new listener
        else {
            if ( this.#events[name].size === this.#maxListeners ) {
                console.warn( Error( `Events max. listeners limit exceeded for event "${name}"` ) );
            }

            this.#events[name].set( listener, once );

            this.#totalListeners++;

            this.#callWatcheers( name, true );
        }
    }

    #unsubscribe ( name, listener ) {
        if ( this.#events[name]?.has( listener ) ) {
            this.#events[name].delete( listener );

            this.#totalListeners--;

            // unsubscribed
            if ( !this.#events[name].size ) {
                delete this.#events[name];

                this.#callWatcheers( name, false );
            }
        }
    }

    #unlink ( target ) {
        const spec = this.#targets.get( target );

        if ( !spec ) return;

        this.#targets.delete( target );

        this.unwatch( spec.watcher );

        for ( const off of Object.values( spec.names ) ) {
            target.off( ...off );
        }
    }

    #callWatcheers ( name, subscribe ) {
        if ( !this.#watchers.size ) return;

        for ( const listener of this.#watchers ) {
            listener( name, subscribe );
        }
    }
}
