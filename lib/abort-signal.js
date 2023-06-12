import Events from "#lib/events";

export default class AbortSignals extends EventTarget {
    #abortConroller = new AbortController();
    #signals = [];
    #events = new Events();

    constructor ( ...signals ) {
        super();

        Object.setPrototypeOf( Object.getPrototypeOf( this ), this.#abortConroller.signal );

        this.addSignals( ...signals );
    }

    // properties
    get aborted () {
        if ( !super.aborted ) {
            for ( const signal of this.#signals ) {
                if ( signal.aborted ) {
                    this.#abortConroller.abort();

                    break;
                }
            }
        }

        return super.aborted;
    }

    // public
    addSignals ( ...signals ) {
        this.#signals.push( ...signals );

        return this;
    }
}
