export default class Options {
    #benchmarks;
    #testPathPattern;
    #testNamePattern;
    #verbose;
    #showSkipped;
    #showPassed;
    #showStackTrace;
    #showConsoleLog;

    constructor ( options = {} ) {

        // set options
        this.#benchmarks = !!options.benchmarks;
        this.testPathPattern = options.testPathPattern;
        this.testNamePattern = options.testNamePattern;
        this.#verbose = !!options.verbose;
        this.#showSkipped = !!options.showSkipped;
        this.#showPassed = !!options.showPassed;
        this.#showStackTrace = !!options.showStackTrace;
        this.#showConsoleLog = !!options.showConsoleLog;
    }

    get benchmarks () {
        return this.#benchmarks;
    }

    get testPathPattern () {
        return this.#testPathPattern;
    }

    set testPathPattern ( value ) {
        if ( !value ) this.#testPathPattern = null;
        else this.#testPathPattern = new RegExp( value, "i" );
    }

    get testNamePattern () {
        return this.#testNamePattern;
    }

    set testNamePattern ( value ) {
        if ( !value ) this.#testNamePattern = null;
        else this.#testNamePattern = new RegExp( value, "i" );
    }

    get verbose () {
        return this.#verbose;
    }

    get showSkipped () {
        return this.#showSkipped;
    }

    get showPassed () {
        return this.#showPassed;
    }

    get showStackTrace () {
        return this.#showStackTrace;
    }

    get showConsoleLog () {
        return this.#showConsoleLog;
    }
}
