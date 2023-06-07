const abortController = new AbortController();

export default class AbortSignals extends EventTarget {
    #aborted = false;
    #signals = [];

    constructor ( ...signals ) {
        super();

        Object.setPrototypeOf( Object.getPrototypeOf( this ), abortController.signal );

        this.addSignals( ...signals );
    }

    // properties
    get aborted () {
        if ( !this.#aborted ) {
            for ( const signal of this.#signals ) {
                if ( signal.aborted ) {
                    this.#aborted = true;

                    break;
                }
            }
        }

        return this.#aborted;
    }

    // public
    addSignals ( ...signals ) {
        this.#signals.push( ...signals );

        return this;
    }
}
