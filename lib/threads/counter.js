import Events from "#lib/events";
import ProxyFinalizationRegistry from "#lib/proxy-finalization-registry";

class CountersSet extends ProxyFinalizationRegistry {

    // protected
    _createTarget ( id, destroy, options = {} ) {
        return new Counter( { ...options, id, destroy } );
    }

    _isTargetDestroyable ( target ) {
        return target.isDestroyable;
    }
}

export default class Counter {
    #id;
    #destroy;
    #value = 0;
    #waitingThreads = new Set();
    #_events;

    constructor ( { id, destroy, value } = {} ) {
        this.#id = id;
        this.#destroy = destroy;
        if ( value ) this.#setValue( value );
    }

    // static
    static get Set () {
        return CountersSet;
    }

    // properties
    get id () {
        return this.#id;
    }

    get isDestroyable () {
        return this.isFinished && !this.waitingThreads && !this.#_events?.listenerCount();
    }

    get value () {
        return this.#value;
    }

    set value ( value ) {
        this.#setValue( value );
    }

    get isFinished () {
        return !this.#value;
    }

    get waitingThreads () {
        return this.#waitingThreads.size;
    }

    // public

    async wait ( { signal } = {} ) {
        if ( !this.#value ) return;

        if ( signal?.aborted ) return;

        return new Promise( resolve => {
            const listener = res => {
                if ( signal ) {
                    signal.removeEventListener( "abort", listener );

                    if ( signal.aborted ) {
                        this.#waitingThreads.delete( listener );

                        if ( !this.waitingThreads.size ) this.#destroy?.();
                    }
                }

                resolve( res );
            };

            signal?.addEventListener( "abort", listener, { "once": true } );

            this.#waitingThreads.add( listener );
        } );
    }

    on ( name, listener ) {
        this.#events.on( name, listener );

        return this;
    }

    once ( name, listener ) {
        this.#events.once( name, listener );

        return this;
    }

    off ( name, listener ) {
        this.#events.off( name, listener );

        return this;
    }

    // private
    get #events () {
        if ( !this.#_events ) {
            this.#_events = new Events().watch( ( name, subscribe ) => {
                if ( !this.#_events.listenerCount() ) {
                    this.#destroy?.();
                }
            } );
        }

        return this.#_events;
    }

    #setValue ( value ) {
        if ( !Number.isInteger( value ) ) throw TypeError( "Semaphore value must be integer" );

        if ( this.#value === value ) return;

        const oldValue = this.#value;

        this.#value = value;

        if ( !oldValue ) {
            this.#_events?.emit( "start" );
        }
        else if ( !this.#value ) {
            this.#runWaitingThreads();

            this.#_events?.emit( "finish" );

            this.#destroy?.();
        }
    }

    #runWaitingThreads ( value ) {
        if ( !this.#waitingThreads.size ) return;

        const waitingThreads = this.#waitingThreads;
        this.#waitingThreads = new Set();

        for ( const listener of waitingThreads ) {
            listener();
        }
    }
}
