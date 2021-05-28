export default class Options {
    #benchmarks;
    #modulePattern;
    #firstLevelPattern;
    #secondLevelPattern;
    #verbose;
    #showSkipped;
    #showPassed;
    #showStackTrace;
    #showConsoleLog;

    constructor ( options = {} ) {

        // set options
        this.#benchmarks = !!options.benchmarks;
        if ( options.modulePattern ) this.#modulePattern = new RegExp( options.modulePattern, "i" );
        if ( options.firstLevelPattern ) this.#firstLevelPattern = new RegExp( options.firstLevelPattern, "i" );
        if ( options.secondLevelPattern ) this.#secondLevelPattern = new RegExp( options.secondLevelPattern, "i" );
        this.#verbose = !!options.verbose;
        this.#showSkipped = !!options.showSkipped;
        this.#showPassed = !!options.showPassed;
        this.#showStackTrace = !!options.showStackTrace;
        this.#showConsoleLog = !!options.showConsoleLog;
    }

    get benchmarks () {
        return this.#benchmarks;
    }

    get modulePattern () {
        return this.#modulePattern;
    }

    get firstLevelPattern () {
        return this.#firstLevelPattern;
    }

    get secondLevelPattern () {
        return this.#secondLevelPattern;
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
