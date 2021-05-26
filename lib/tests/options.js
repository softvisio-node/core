export default class Options {
    #runTests = true;
    #runBenchmarks = true;
    #testPathPattern;
    #testNamePattern;

    constructor ( options = {} ) {

        // set options
        this.runTests = options.runTests;
        this.runBenchmarks = options.runBenchmarks;
        this.testPathPattern = options.testPathPattern;
        this.testNamePattern = options.testNamePattern;
    }

    get runTests () {
        return this.#runTests;
    }

    set runTests ( value ) {
        this.#runTests = !!value;
    }

    get runBenchmarks () {
        return this.#runBenchmarks;
    }

    set runBenchmarks ( value ) {
        this.#runBenchmarks = !!value;
    }

    get testPathPattern () {
        return this.#testPathPattern;
    }

    set testPathPattern ( value ) {
        if ( !value ) this.#testPathPattern = null;
        else this.#testPathPattern = new RegExp( `${value}`, "i" );
    }

    get testNamePattern () {
        return this.#testNamePattern;
    }

    set testNamePattern ( value ) {
        if ( !value ) this.#testNamePattern = null;
        else this.#testNamePattern = new RegExp( `${value}`, "i" );
    }
}
