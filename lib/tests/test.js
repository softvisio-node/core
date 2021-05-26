export default class Test {
    #name;
    #skip;

    #isSkipped = false;

    constructor ( name, options = {} ) {
        this.#name = name;
        this.#skip = !!options.skip;
    }

    get name () {
        return this.#name;
    }

    get skip () {
        return this.#skip;
    }

    get isSkipped () {
        return this.#isSkipped;
    }

    // protected
    _skip () {
        this.#isSkipped = true;
    }
}
