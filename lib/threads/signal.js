import IndexedDeque from "#lib/data-structures/indexed-deque";
import Events from "#lib/events";
import ProxyFinalizationRegistry from "#lib/proxy-finalization-registry";

class SignalsSet extends ProxyFinalizationRegistry {

    // protected
    _createTarget ( id, destroy, options ) {
        return new Signal( { id, destroy } );
    }

    _isTargetDestroyable ( target ) {
        return target.isDestroyable;
    }
}

export default class Signal {
    #id;
    #destroy;
    #isSent = false;
    #value;
    #waitingThreads = new IndexedDeque();
    #_events;

    constructor ( { id, destroy } = {} ) {
        this.#id = id;
        this.#destroy = destroy;
    }

    // static
    static get Set () {
        return SignalsSet;
    }

    // properties
    get id () {
        return this.#id;
    }

    get isDestroyable () {
        return !this.#_events?.hasListeners() && !this.isSent && !this.waitingThreads.length;
    }

    get isSent () {
        return this.#isSent;
    }

    get value () {
        return this.#value;
    }

    get waitingThreads () {
        return this.#waitingThreads.length;
    }

    // public
    send ( value ) {
        const wasEmpty = this.#clearSignal();

        if ( this.#waitingThreads.length ) {
            this.#waitingThreads.shift()( value );

            this.#checkEmppty( wasEmpty );
        }
        else {

            // store signal
            this.#isSent = true;
            this.#value = value;
        }

        return this;
    }

    trySend ( value ) {
        const wasEmpty = this.#clearSignal();

        if ( this.#waitingThreads.length ) {
            this.#waitingThreads.shift()( value );
        }

        this.#checkEmppty( wasEmpty );

        return this;
    }

    broadcast ( value ) {
        const wasEmpty = this.#clearSignal();

        if ( this.#waitingThreads.length ) {
            const waitingThreads = this.#waitingThreads;
            this.#waitingThreads = new IndexedDeque();

            for ( const thread of waitingThreads ) thread( value );
        }

        this.#checkEmppty( wasEmpty );

        return this;
    }

    async wait ( { highPriority, signal } = {} ) {
        if ( this.isSent ) {
            const value = this.#value;

            const wasEmpty = this.#clearSignal();

            this.#checkEmppty( wasEmpty );

            return value;
        }
        else {
            if ( signal?.aborted ) return;

            return new Promise( resolve => {
                const listener = res => {
                    if ( signal ) {
                        signal.removeEventListener( "abort", listener );

                        if ( signal.aborted ) {
                            this.#waitingThreads.delete( listener );

                            if ( !this.waitingThreads.length ) this.#destroy?.();
                        }
                    }

                    resolve( res );
                };

                signal?.addEventListener( "abort", listener, { "once": true } );

                if ( highPriority ) {
                    this.#waitingThreads.unshift( listener );
                }
                else {
                    this.#waitingThreads.push( listener );
                }
            } );
        }
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
                if ( !this.#_events.hasListeners() ) {
                    this.#destroy?.();
                }
            } );
        }

        return this.#_events;
    }

    #clearSignal () {
        const wasEmpty = !this.#isSent && !this.#waitingThreads.length;

        this.#isSent = false;
        this.#value = undefined;

        return wasEmpty;
    }

    #checkEmppty ( wasEmpty ) {
        if ( wasEmpty || this.#isSent || this.#waitingThreads.length ) return;

        this.#_events?.emit( "empty" );

        this.#destroy?.();
    }
}
