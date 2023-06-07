export default class AbortSignals {
    #abortController;
    #aborted = false;
    #signals = [];

    constructor () {
        this.#abortController = new AbortController();

        Object.setPrototypeOf( this, this.#abortController.signal );
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
        this.#signals.ppish( ...signals );

        return this;
    }
}
