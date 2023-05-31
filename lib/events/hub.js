const DEFAULT_MAX_LISTENERS = 10;

export default class EventsHub {
    #maxListeners;
    #events = {};
    #targets = new Map();
    #totalListeners = 0;

    constructor ( { maxListeners } = {} ) {
        this.#maxListeners = maxListeners || DEFAULT_MAX_LISTENERS;
    }

    // properties
    get maxListeners () {
        return this.#maxListeners;
    }

    // public
    on ( name, listener ) {
        return this.#subscribe( name, listener, false );
    }

    once ( name, listener ) {
        return this.#subscribe( name, listener, true );
    }

    off ( name, listener ) {
        return this.#unsubscribe( name, listener );
    }

    emit ( name, ...args ) {
        if ( this.#events[name] ) {
            for ( const [listener, once] of this.#events[name].entries() ) {
                listener( ...args );

                if ( once ) this.#unsubscribe( name, listener );
            }

            return this;
        }
    }

    listenerCount ( name ) {
        if ( name ) {
            return this.#events[name]?.size || 0;
        }
        else {
            return this.#totalListeners;
        }
    }

    link ( target, { on, forwarder } = {} ) {

        // already linked
        if ( this.#targets.has( target ) ) this.unlink( target );

        on ||= name => name;
        forwarder ||= ( name, args ) => this.emit( name, ...args );

        const spec = {
            "names": {},
            "subscriber": name => {
                const remoteName = on( name );

                // do not subscribe
                if ( !remoteName ) return;

                // subscribe
                const listener = ( ...args ) => forwarder( name, args );

                spec.names[name] = [remoteName, listener];

                target.on( remoteName, listener );
            },
        };

        this.#targets.set( target, spec );

        for ( const name of Object.keys( this.#events ) ) {
            spec.subscriber( name );
        }

        return this;
    }

    unlink ( target ) {
        if ( target ) {
            this.#unlink( target );
        }
        else {
            for ( const target of this.#targets.keys() ) {
                this.#unlink( target );
            }
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
            this.#events[name].set( listener, once );

            this.#totalListeners++;

            if ( this.#events[name].size > this.#maxListeners ) {
                throw Error( `Events hub max. listeners linit reached for event "${name}"` );
            }

            // subscribed
            if ( this.#events[name].size === 1 ) {

                // subscribe on linked targets
                for ( const { subscriber } of this.#targets.values() ) {
                    subscriber( name );
                }
            }
        }

        return this;
    }

    #unsubscribe ( name, listener ) {
        if ( name && listener ) {
            this.#unsubscribeListener( name, listener );
        }
        else if ( name ) {
            if ( this.#events[name] ) {
                for ( const listener of this.#events[name].keys() ) {
                    this.#unsubscribeListener( name, listener );
                }
            }
        }
        else {
            for ( const name of Object.keys( this.#events ) ) {
                for ( const listener of this.#events[name].keys() ) {
                    this.#unsubscribeListener( name, listener );
                }
            }
        }

        return this;
    }

    #unsubscribeListener ( name, listener ) {
        if ( this.#events[name]?.has( listener ) ) {
            this.#events[name].delete( listener );

            this.#totalListeners--;

            // unsubscribed
            if ( !this.#events[name].size ) {
                delete this.#events[name];

                // unsubscribe linked targets
                for ( const [target, spec] of this.#targets.entries() ) {
                    const off = spec.names[name];

                    if ( off ) {
                        target.off( ...off );

                        delete spec.names[name];
                    }
                }
            }
        }
    }

    #unlink ( target ) {
        const spec = this.#targets.get( target );

        if ( !spec ) return;

        this.#targets.delete( target );

        for ( const off of Object.values( spec.names ) ) {
            target.off( ...off );
        }

        return;
    }
}
