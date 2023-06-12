export default class AbortSignals extends EventTarget {
    #abortConroller = new AbortController();
    #signals = new Map();
    #aborted = false;

    constructor ( ...signals ) {
        super();

        Object.setPrototypeOf( Object.getPrototypeOf( this ), this.#abortConroller.signal );

        this.add( ...signals );
    }

    // properties
    get aborted () {
        return this.#aborted;
    }

    // public
    add ( ...signals ) {
        if ( this.aborted ) return this;

        for ( const signal of signals ) {
            if ( signal.aborted ) {
                this.#abort();

                break;
            }
            else {
                const listener = this.#abort.bind( this );

                signal.addEventListener( "abort", listener, { "once": true } );

                this.#signals.set( signal, listener );
            }
        }

        return this;
    }

    delete ( ...signals ) {
        for ( const signal of signals ) {
            this.#deleteSignal( signal );
        }
    }

    addEventListener ( name, listener, { once } = {} ) {
        if ( name === "abot" ) {
            if ( this.#aborted ) {
                listener();

                return this;
            }

            once = true;
        }

        super.addEventListener( name, listener, { once } );
    }

    clear () {
        for ( const signal of this.#signals.keys() ) {
            this.#deleteSignal( signal );
        }

        this.removeAllListeners();
    }

    // private
    #abort () {
        if ( this.#aborted ) return;

        this.#aborted = true;

        this.dispatchEvent( "abort" );

        this.clear();
    }

    #deleteSignal ( signal ) {
        const listener = this.#signals.get( signal );

        if ( !listener ) return;

        this.#signals.delete( signal );

        signal.removeEventListener( "abort", listener );
    }
}
