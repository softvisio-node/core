import result from "#lib/result";

const DEFAULT_MAX_LISTENERS = 10;

export default class Events {
    #maxListeners;
    #totalListeners = 0;
    #events = {};
    #watchers = new Set();
    #linked = new Map();
    #forwarded = new Map();

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
            if ( this.#events[ name ] ) {
                for ( const listener of this.#events[ name ].keys() ) {
                    this.#off( name, listener );
                }
            }
        }
        else {
            for ( const name of Object.keys( this.#events ) ) {
                for ( const listener of this.#events[ name ].keys() ) {
                    this.#off( name, listener );
                }
            }
        }

        return this;
    }

    emit ( name, ...args ) {
        if ( this.#events[ name ] ) {
            for ( const [ listener, once ] of this.#events[ name ].entries() ) {
                try {
                    listener( ...args );
                }
                catch ( e ) {
                    console.error( e );
                }

                if ( once ) this.#off( name, listener );
            }
        }

        if ( this.#forwarded.size ) {
            for ( const forward of this.#forwarded.values() ) {
                forward.watcher( name, args );
            }
        }

        return this;
    }

    async call ( name, ...args ) {
        var res;

        if ( this.#events[ name ] ) {
            for ( const [ listener, once ] of this.#events[ name ].entries() ) {
                if ( !res || res.ok ) {
                    try {
                        res = result.try( await ( listener[ Symbol.for( "event-callback" ) ] || listener )( ...args ), {
                            "allowUndefined": true,
                        } );
                    }
                    catch ( e ) {
                        res = result.catch( e );
                    }
                }

                if ( once ) this.#off( name, listener );
            }
        }

        return res || result( 200 );
    }

    listenerCount ( name ) {
        if ( name ) {
            return this.#events[ name ]?.size || 0;
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

    link ( emitter, { on, forwarder } = {} ) {

        // already linked
        if ( this.#linked.has( emitter ) ) this.unlink( emitter );

        on ||= name => name;

        forwarder ||= ( name, args, { call } ) => {
            if ( call ) {
                return this.call( name, ...args );
            }
            else {
                this.emit( name, ...args );
            }
        };

        const link = {
            "names": {},
            "watcher": ( name, subscribe ) => {

                // subscribe
                if ( subscribe ) {
                    let remoteNames = on( name );

                    // do not subscribe
                    if ( !remoteNames ) return;

                    if ( !Array.isArray( remoteNames ) ) remoteNames = [ remoteNames ];

                    const listener = ( ...args ) => forwarder( name, args, { "call": false } );

                    listener[ Symbol.for( "event-callback" ) ] = ( ...args ) => forwarder( name, args, { "call": true } );

                    link.names[ name ] = [];

                    for ( const remoteName of remoteNames ) {
                        link.names[ name ].push( [ remoteName, listener ] );

                        if ( emitter instanceof EventTarget ) {
                            emitter.addEventListener( remoteName, listener );
                        }
                        else {
                            emitter.on( remoteName, listener );
                        }
                    }
                }

                // unsubscribe
                else if ( link.names[ name ] ) {
                    const events = link.names[ name ];
                    delete link.names[ name ];

                    for ( const event of events ) {
                        if ( emitter instanceof EventTarget ) {
                            emitter.removeEventListener( ...event );
                        }
                        else {
                            emitter.off( ...event );
                        }
                    }
                }
            },
        };

        this.#linked.set( emitter, link );

        for ( const name of Object.keys( this.#events ) ) {
            link.watcher( name, true );
        }

        return this;
    }

    unlink ( emitter ) {
        this.#unlink( emitter );

        return this;
    }

    unlinkAll () {
        for ( const emitter of this.#linked.keys() ) {
            this.#unlink( emitter );
        }

        return this;
    }

    forward ( emitter, { on, forwarder } = {} ) {

        // already linked
        if ( this.#forwarded.has( emitter ) ) this.unforward( emitter );

        on ||= name => name;

        forwarder ||= ( name, args ) => emitter.emit( name, ...args );

        const forward = {
            "watcher": ( name, args ) => {
                let remoteNames = on( name );

                if ( !remoteNames ) return;

                if ( !Array.isArray( remoteNames ) ) remoteNames = [ remoteNames ];

                for ( const remoteName of remoteNames ) {
                    forwarder( remoteName, args );
                }
            },
        };

        this.#forwarded.set( emitter, forward );

        return this;
    }

    unforward ( emitter ) {
        this.#unforward( emitter );

        return this;
    }

    unforwardAll () {
        for ( const emitter of this.#forwarded.keys() ) {
            this.#unforward( emitter );
        }

        return this;
    }

    clear () {
        return this.unlinkAll().unforwardAll().unwatchAll().offAll();
    }

    // private
    #on ( name, listener, once ) {
        this.#events[ name ] ||= new Map();

        // replace listener
        if ( this.#events[ name ].has( listener ) ) {
            this.#events[ name ].set( listener, once );
        }

        // add new listener
        else {
            if ( this.#events[ name ].size === this.#maxListeners ) {
                console.warn( Error( `Events max. listeners limit exceeded for event "${ name }"` ) );
            }

            this.#events[ name ].set( listener, once );

            this.#totalListeners++;

            // subscribed
            if ( this.#events[ name ].size === 1 ) {
                this.#callWatcheers( name, true );
            }
        }
    }

    #off ( name, listener ) {
        if ( this.#events[ name ]?.has( listener ) ) {
            this.#events[ name ].delete( listener );

            this.#totalListeners--;

            // unsubscribed
            if ( !this.#events[ name ].size ) {
                delete this.#events[ name ];

                this.#callWatcheers( name, false );
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

    #unlink ( emitter ) {
        const link = this.#linked.get( emitter );

        if ( !link ) return;

        this.#linked.delete( emitter );

        for ( const off of Object.values( link.names ) ) {
            for ( let n = 0; n < off.length; n++ ) {
                if ( emitter instanceof EventTarget ) {
                    emitter.removeEventListener( ...off[ n ] );
                }
                else {
                    emitter.off( ...off[ n ] );
                }
            }
        }
    }

    #unforward ( emitter ) {
        this.#forwarded.delete( emitter );
    }
}
