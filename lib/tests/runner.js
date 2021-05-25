import * as text from "#lib/text";
import glob from "glob";
import url from "url";
import Module from "#lib/tests/module";

class Runner {
    #runTests = true;
    #runBenchmarks = true;
    #testPathPattern;
    #testNamePattern;

    #runManually;
    #queue = [];

    #stats = {
        "benchmarks": {
            "total": 0,
            "ran": 0,
            "skipped": 0,
        },
        "tests": {
            "total": 0,
            "skipped": 0,
            "ran": 0,
            "passed": 0,
            "failed": 0,
        },
    };

    #module; // current loading module
    #group; // current group
    #test; // currently running test or benchmark
    #onEnd;
    #failedTests = [];

    set runTests ( value ) {
        this.#runTests = !!value;
    }

    set runBenchmarks ( value ) {
        this.#runBenchmarks = !!value;
    }

    set testPathPattern ( value ) {
        if ( !value ) this.#testPathPattern = null;
        else this.#testPathPattern = new RegExp( `${value}`, "i" );
    }

    set testNamePattern ( value ) {
        if ( !value ) this.#testNamePattern = null;
        else this.#testNamePattern = new RegExp( `${value}`, "i" );
    }

    // public
    async loadTests ( path, options = {} ) {
        this.#runManually = true;
        const tests = await import( "#lib/tests" );
        global.test = tests.test;
        global.expect = tests.expect;
        global.bench = tests.bench;
        global.describe = tests.describe;

        const modules = glob.sync( "**/*.js", { "cwd": url.fileURLToPath( path ), "nodir": true } );

        for ( const module of modules ) {
            this.#module = new Module( path + "/" + module, module );

            try {
                await import( this.#module.path );
            }
            catch ( e ) {
                console.log( e );
            }

            this.#module = null;
        }
    }

    async run ( options = {} ) {
        this.runTests = options.runTests;
        this.runBenchmarks = options.runBenchmarks;
        this.testPathPattern = options.testPathPattern;
        this.testNamePattern = options.testNamePattern;

        await new Promise( resolve => {
            this.#onEnd = resolve;

            this.#run();
        } );

        for ( const test of this.#failedTests ) {
            console.log( "" );

            console.log( text.ansi.error( " ● " ), "[T]", test.name );

            test.printLog();
        }

        console.log( "" );

        // final report
        console.log( "Tests:     ", `${this.#stats.tests.total} total,`, `${text.ansi.dim( this.#stats.tests.skipped )} skipped,`, `${this.#stats.tests.ran} ran,`, `${text.ansi.ok( " " + this.#stats.tests.passed + " " )} passed,`, `${text.ansi.error( " " + this.#stats.tests.failed + " " )} failed` );

        console.log( "Benchmarks:", `${this.#stats.benchmarks.total} total,`, `${text.ansi.dim( this.#stats.benchmarks.skipped )} skipped,`, `${this.#stats.benchmarks.ran} ran` );

        // return result
        if ( this.#stats.tests.failed ) return result( 500 );
        else return result( 200 );
    }

    add ( test ) {
        if ( this.#module ) test.module = this.#module;

        // group
        if ( test.isGroup ) {
            if ( this.#group ) throw `Nested "describe" statements are not supported`;

            this.#group = test;

            test.run();

            this.#group = null;
        }

        // test or benchmark
        else {
            if ( this.#group ) test.group = this.#group;

            this.#queue.push( test );

            if ( !this.#runManually ) this.#run();
        }
    }

    addTestResult ( res ) {
        if ( !this.#test ) throw Error( `Expect outside test` );

        this.#test.addResult( res );
    }

    // private
    async #run () {
        if ( this.#test ) return;

        const test = this.#queue.shift();

        if ( !test ) {
            if ( this.#onEnd ) {
                const resolve = this.#onEnd;
                this.#onEnd = null;
                resolve();
            }

            return;
        }

        this.#onTestStart( test );

        // check, if test should be skipped
        try {
            if ( test.skip ) throw "skip";

            if ( this.#testPathPattern && test.module && !this.#testPathPattern.test( test.module.name ) ) throw "skip";

            // if ( this.#testNamePattern && !this.#testNamePattern.test( test.name ) ) throw "skip";

            if ( this.#testNamePattern ) {
                if ( test.group ) {
                    if ( !this.#testNamePattern.test( test.group.name ) ) throw "skip";
                }
                else {
                    if ( !this.#testNamePattern.test( test.name ) ) throw "skip";
                }
            }

            if ( test.isBenchmark && !this.#runBenchmarks ) throw "skip";

            if ( test.isTest && !this.#runTests ) throw "skip";
        }
        catch ( e ) {
            this.#onTestSkip( test );

            this.#run();

            return;
        }

        this.#test = test;

        await test.run();

        this.#test = null;

        this.#onTestEnd( test );

        this.#run();
    }

    #onTestStart ( test ) {
        if ( test.isTest ) this.#stats.tests.total++;
        else this.#stats.benchmarks.total++;

        if ( test.module && this.#module !== test.module ) console.log( " ".repeat( 2 ) + "module: " + test.module.name );
        this.#module = test.module;

        if ( test.group && this.#group !== test.group ) console.log( ( this.#module ? " ".repeat( 4 ) : " ".repeat( 2 ) ) + "group: " + test.group.name );
        this.#group = test.group;
    }

    #onTestSkip ( test ) {

        // test
        if ( test.isTest ) {
            this.#stats.tests.skipped++;

            console.log( this.#getIndent(), text.ansi.dim( " ○ " ), text.ansi.dim( "[T] skipped" ), text.ansi.dim( `${test.name}` ) );
        }

        // benchmark
        else if ( test.isBenchmark ) {
            this.#stats.benchmarks.skipped++;

            console.log( this.#getIndent(), text.ansi.dim( " ○ " ), text.ansi.dim( "[B] skipped" ), text.ansi.dim( `${test.name}` ) );
        }
    }

    #onTestEnd ( test ) {

        // test
        if ( test.isTest ) {
            this.#stats.tests.ran++;

            const duration = test.duration.toFixed( 2 );

            // passed
            if ( test.ok ) {
                this.#stats.tests.passed++;

                console.log( this.#getIndent(), text.ansi.ok( " √ " ), "[T]", `${test.name} (${duration} ms)` );
            }

            // failed
            else {
                this.#stats.tests.failed++;

                this.#failedTests.push( test );

                console.log( this.#getIndent(), text.ansi.error( " × " ), "[T]", text.ansi.hl( `${test.name} (${duration} ms)` ) );
            }
        }

        // benchmark
        else if ( test.isBenchmark ) {
            this.#stats.benchmarks.ran++;

            console.log( this.#getIndent(), text.ansi.ok( " √ " ), "[B]", `${test.name}` );
        }
    }

    #getIndent () {
        var indent = "";

        if ( this.#module ) indent += " ".repeat( 2 );
        if ( this.#group ) indent += " ".repeat( 2 );

        return indent;
    }
}

const runner = global.SOFTVISIO_TESTS_RUNNER || new Runner();

if ( !global.SOFTVISIO_TESTS_RUNNER ) global.SOFTVISIO_TESTS_RUNNER = runner;

export { runner as default };
