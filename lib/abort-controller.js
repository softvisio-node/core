import AbortSignal from "#lib/abort-signal";

export default class AbortController extends global.AbortController {
    #aborted = false;
    #reason;
    #signal;
    #abort;

    constructor () {
        super();

        [this.#signal, this.#abort] = AbortSignal.fromAbortController();
    }

    // properties
    get aborted () {
        return this.#aborted;
    }

    get reason () {
        return this.#reason;
    }

    get signal () {
        return this.#signal;
    }

    // public
    abort ( reason ) {
        if ( this.#aborted ) return;

        this.#aborted = true;
        this.#reason = reason;

        this.#abort( reason );
    }

    clear () {
        this.#aborted = false;
        this.#reason = null;

        [this.#signal, this.#abort] = AbortSignal.fromAbortController();
    }
}
