export default class AbortSignals extends EventTarget {
    #abortController;
    #aborted = false;
    #signals = [];

    constructor () {
        super();

        this.#abortController = new AbortController();

        Object.setPrototypeOf( Object.getPrototypeOf( this ), this.#abortController.signal );
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
