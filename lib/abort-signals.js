export default class AbortSignals extends AbortSignal {
    #aborted = false;
    #signals = [];

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
