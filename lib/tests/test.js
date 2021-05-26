export default class Test {
    #name;
    #skip;

    #isLoaded = false;
    #isSkipped = false;
    #isTested = false;

    #result;

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

    get isLoaded () {
        return this.#isLoaded;
    }

    get isSkipped () {
        return this.#isSkipped;
    }

    get isTested () {
        return this.#isTested;
    }

    get result () {
        return this.#result;
    }

    // protected
    _setIsLoaded () {
        this.#isLoaded = true;
    }

    _skip () {
        this.#isSkipped = true;
    }

    _setIsTested () {
        this.#isTested = true;
    }

    _setResult ( res ) {
        this.#result = res;
    }
}
