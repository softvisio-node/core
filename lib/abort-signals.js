export default class AbortSignals extends AbortSignal {
    #signals = [];

    // properties
    get aborted () {
        for ( const signal of this.#signals ) {
            if ( signal.aborted ) return true;
        }

        return false;
    }

    // public
    addSignals ( ...signals ) {
        this.#signals.ppish( ...signals );

        return this;
    }
}
