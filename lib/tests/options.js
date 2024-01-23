export default class Options {
    #benchmarks;
    #modulePattern;
    #firstLevelPattern;
    #secondLevelPattern;

    // run options
    #verbose;
    #showSkipped;
    #showPassed;
    #showStackTrace;
    #showConsoleLog;

    // plan options
    #level;
    #json;

    constructor ( options = {} ) {
        this.#benchmarks = !!options.benchmarks;

        try {
            if ( options.modulePattern ) this.#modulePattern = new RegExp( options.modulePattern, "i" );
            if ( options.firstLevelPattern ) this.#firstLevelPattern = new RegExp( options.firstLevelPattern, "i" );
            if ( options.secondLevelPattern ) this.#secondLevelPattern = new RegExp( options.secondLevelPattern, "i" );
        }
        catch ( e ) {
            throw result( [ 500, `Pattern is invalid. ` + e ] );
        }

        this.#verbose = !!options.verbose;
        this.#showSkipped = !!options.showSkipped;
        this.#showPassed = !!options.showPassed;
        this.#showStackTrace = !!options.showStackTrace;
        this.#showConsoleLog = !!options.showConsoleLog;

        this.#level = options.level || 0;
        this.#json = !!options.json;
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

    get level () {
        return this.#level;
    }

    get json () {
        return this.#json;
    }
}
