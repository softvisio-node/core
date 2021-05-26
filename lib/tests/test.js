export default class Test {
    #name;
    #skip;

    #isSkipped = false;
    #isTested = false;

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

    get isTested () {
        return this.#isTested;
    }

    // protected
    _skip () {
        this.#isSkipped = true;
    }

    _setIsTested () {
        this.#isTested = true;
    }
}
