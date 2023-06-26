const signal = global.AbortSignal.abort();

const abortMethod = Symbol();

export default class AbortSignal extends EventTarget {
    #signals = new Map();
    #aborted = false;
    #reason;

    constructor ( ...signals ) {
        super();

        Object.setPrototypeOf( Object.getPrototypeOf( this ), signal );

        this.add( ...signals );
    }

    // static
    static any ( signals ) {
        return new this().add( ...signals );
    }

    static fromAbortController () {
        const signal = new this();

        return [signal, signal[abortMethod].bind( signal )];
    }

    // properties
    get aborted () {
        return this.#aborted;
    }

    get reason () {
        return this.#reason;
    }

    // public
    addEventListener ( name, listener, { once } = {} ) {
        if ( name === "abot" && this.#aborted ) {
            if ( !once ) {
                super.addEventListener( name, listener );
            }

            listener( new Event( "abort" ) );

            return this;
        }

        super.addEventListener( name, listener, { once } );

        return this;
    }

    [abortMethod] ( reason ) {
        this.#abort( reason );
    }

    add ( ...signals ) {
        if ( this.aborted ) return this;

        for ( const signal of signals ) {
            if ( this.#signals.has( signal ) ) continue;

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

        return this;
    }

    clear () {
        this.#aborted = false;
        this.#reason = null;

        this.#deleteAllSignals();

        return this;
    }

    // private
    #abort ( reason ) {
        if ( this.#aborted ) return;

        this.#aborted = true;
        this.#reason = reason;

        super.dispatchEvent( new Event( "abort" ) );

        this.#deleteAllSignals();
    }

    #deleteAllSignals () {
        for ( const signal of this.#signals.keys() ) {
            this.#deleteSignal( signal );
        }
    }

    #deleteSignal ( signal ) {
        const listener = this.#signals.get( signal );

        if ( !listener ) return;

        this.#signals.delete( signal );

        signal.removeEventListener( "abort", listener );
    }
}
