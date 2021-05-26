import * as text from "#lib/text";
import glob from "glob";
import url from "url";
import Module from "#lib/tests/module";
import Options from "#lib/tests/options";

class Runner {
    #modules = [];

    #isTested = false;

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

    #module; // XXX current loading module
    #group; // XXX current group
    #test; // XXX currently running test or benchmark
    #onEnd; // XXX remove
    #failedTests = [];

    // public
    async loadTests ( path ) {

        // export global functions
        const tests = await import( "#lib/tests" );
        global.test = tests.test;
        global.expect = tests.expect;
        global.bench = tests.bench;
        global.describe = tests.describe;

        // read modules list
        const modules = glob.sync( "**/*.js", { "cwd": url.fileURLToPath( path ), "nodir": true } );

        for ( const modulePath of modules ) {
            const module = new Module( path + "/" + modulePath, modulePath );

            this.#addModule( module );

            await this.#loadModule( module );
        }
    }

    // XXX report
    async run ( options = {} ) {
        options = new Options( options );

        await this.#run( options );

        process.exit();

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

    addTest ( test ) {
        if ( this.#isTested ) throw Error( `Nested tests are not supproted` );

        // automatically create default module
        if ( !this.#module ) {
            const module = new Module();

            this.#addModule();

            this.#loadModule( module );
        }

        this.#module.addTest( test );
    }

    addTestResult ( res ) {
        if ( !this.#module ) throw Error( `Expect called outside of the test` );

        this.#module.addTestResult( res );
    }

    // private
    #addModule ( module ) {
        this.#modules.push( module );

        if ( !module.path ) this.#module = module;
    }

    async #loadModule ( module ) {

        // set current module
        this.#module = module;

        await module.load();

        // undefine current module
        this.#module = null;
    }

    async #run ( options ) {
        if ( this.#isTested ) throw Error( `Tests are already performed` );

        this.#isTested = true;

        for ( const module of this.#modules ) {
            this.#module = module;

            await module.run( options );

            this.#module = null;
        }
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
