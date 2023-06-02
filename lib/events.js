const DEFAULT_MAX_LISTENERS = 10;

export default class Events {
    #maxListeners;
    #totalListeners = 0;
    #events = {};
    #watchers = new Set();
    #linked = new Map();

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
        this.#on( name, listener, false );

        return this;
    }

    once ( name, listener ) {
        this.#on( name, listener, true );

        return this;
    }

    off ( name, listener ) {
        this.#off( name, listener );

        return this;
    }

    offAll ( name ) {
        if ( name ) {
            if ( this.#events[name] ) {
                for ( const listener of this.#events[name].keys() ) {
                    this.#off( name, listener );
                }
            }
        }
        else {
            for ( const name of Object.keys( this.#events ) ) {
                for ( const listener of this.#events[name].keys() ) {
                    this.#off( name, listener );
                }
            }
        }

        return this;
    }

    emit ( name, ...args ) {
        if ( this.#events[name] ) {
            for ( const [listener, once] of this.#events[name].entries() ) {
                listener( ...args );

                if ( once ) this.#off( name, listener );
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
        this.#watchers.clear();

        return this;
    }

    link ( target, { on, forwarder } = {} ) {

        // already linked
        if ( this.#linked.has( target ) ) this.unlink( target );

        on ||= name => name;

        forwarder ||= ( name, args ) => this.emit( name, ...args );

        const link = {
            "names": {},
            "watcher": ( name, subscribe ) => {

                // subscribe
                if ( subscribe ) {
                    let remoteNames = on( name );

                    // do not subscribe
                    if ( !remoteNames ) return;

                    if ( !Array.isArray( remoteNames ) ) remoteNames = [remoteNames];

                    const listener = ( ...args ) => forwarder( name, args );

                    link.names[name] = [];

                    for ( const remoteName of remoteNames ) {
                        link.names[name].push( [remoteName, listener] );

                        target.on( remoteName, listener );
                    }
                }

                // unsubscribe
                else if ( link.names[name] ) {
                    const events = link.names[name];
                    delete link.names[name];

                    for ( const event of events ) {
                        target.off( ...event );
                    }
                }
            },
        };

        this.#linked.set( target, link );

        for ( const name of Object.keys( this.#events ) ) {
            link.watcher( name, true );
        }

        return this;
    }

    unlink ( target ) {
        this.#unlink( target );

        return this;
    }

    unlinkAll () {
        for ( const target of this.#linked.keys() ) {
            this.#unlink( target );
        }

        return this;
    }

    clear () {
        return this.unlinkAll().unwatchAll().offAll();
    }

    // private
    #on ( name, listener, once ) {
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

            // subscribed
            if ( this.#events[name].size === 1 ) {
                this.#callWatcheers( name, true );
            }
        }
    }

    #off ( name, listener ) {
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
        const link = this.#linked.get( target );

        if ( !link ) return;

        this.#linked.delete( target );

        for ( const off of Object.values( link.names ) ) {
            for ( let n = 0; n < off.length; n++ ) {
                target.off( ...off[n] );
            }
        }
    }

    #callWatcheers ( name, subscribe ) {
        if ( this.#watchers.size ) {
            for ( const listener of this.#watchers ) {
                listener( name, subscribe );
            }
        }

        if ( this.#linked.size ) {
            for ( const link of this.#linked.values() ) {
                link.watcher( name, subscribe );
            }
        }
    }
}
