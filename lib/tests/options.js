export default class Options {
    #runTests = true;
    #runBenchmarks;
    #testPathPattern;
    #testNamePattern;
    #list;
    #verbose;
    #showErrors = true;
    #showStackTrace;
    #showConsoleLog;

    constructor ( options = {} ) {

        // set options
        this.runTests = options.runTests;
        this.runBenchmarks = options.runBenchmarks;
        this.testPathPattern = options.testPathPattern;
        this.testNamePattern = options.testNamePattern;
        this.#list = !!options.list;
        this.#verbose = !!options.verbose;
        this.#showErrors = !!options.showError;
        this.#showStackTrace = !!options.showStackTrace;
        this.#showConsoleLog = !!options.showConsoleLog;
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

    get list () {
        return this.#list;
    }

    get verbose () {
        return this.#verbose;
    }

    get showErrors () {
        return this.#showErrors;
    }

    get showStackTrace () {
        return this.#showStackTrace;
    }

    get showConsoleLog () {
        return this.#showConsoleLog;
    }
}
