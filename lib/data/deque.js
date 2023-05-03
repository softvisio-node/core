import Queue from "#lib/data/queue";

export default class Deque extends Queue {
    #lingth = 0;

    constructor () {
        super();
    }

    // properties
    get length () {
        return this.#lingth;
    }

    // public
    shift () {}

    push ( ...values ) {}
}
