import ansi from "#lib/text/ansi";

export default class Test {
    #name;
    #skip;

    #isLoaded = false;
    #isSkipped = false;
    #isTested = false;

    #result;
    #stat = {
        "total": 0,
        "totalSkipped": 0,

        "totalModules": 0,
        "skippedModules": 0,
        "ranModules": 0,
        "passModules": 0,
        "failModules": 0,

        "totalGroups": 0,
        "skippedGroups": 0,
        "ranGroups": 0,
        "passGroups": 0,
        "failGroups": 0,

        "totalTests": 0,
        "skippedTests": 0,
        "ranTests": 0,
        "passTests": 0,
        "failTests": 0,

        "totalBenchmarks": 0,
        "skippedBenchmarks": 0,
        "ranBenchmarks": 0,
        "passBenchmarks": 0,
        "failBenchmarks": 0,
    };

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

    get stat () {
        return this.#stat;
    }

    // public
    addStat ( test ) {
        var type;

        if ( test.isModule ) {
            type = "Modules";

            this.#sumStat( test.stat );
        }
        else if ( test.isGroup ) {
            type = "Groups";

            this.#sumStat( test.stat );
        }
        else if ( test.isTest ) {
            type = "Tests";
        }
        else if ( test.isBenchmark ) {
            type = "Benchmarks";
        }

        // update stat
        this.#stat.total++;
        this.stat[ "total" + type ]++;

        if ( test.isSkipped ) {
            this.#stat.totalSkipped++;

            this.stat[ "skipped" + type ]++;
        }
        else {
            this.stat[ "ran" + type ]++;

            if ( test.result.ok ) this.stat[ "pass" + type ]++;
            else this.stat[ "fail" + type ]++;
        }
    }

    // protected
    _setIsLoaded () {
        this.#isLoaded = true;
    }

    _skip ( statusText ) {
        this._setResult( result( [ 200, statusText ] ) );

        this.#isSkipped = true;
    }

    _setIsTested () {
        this.#isTested = true;
    }

    _setResult ( res ) {

        // do not update result if test is skipped
        if ( this.isSkipped ) return;

        if ( !this.#result ) {
            this.#result = res;
        }
        else if ( this.#result.ok ) {
            this.#result = res;
        }
    }

    _formatStatusText ( statusText ) {
        return ansi.dim( "(" + statusText + ")" );
    }

    // private
    #sumStat ( stat ) {
        for ( const name in this.#stat ) this.#stat[ name ] += stat[ name ] || 0;
    }
}
