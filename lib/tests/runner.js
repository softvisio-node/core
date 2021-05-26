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

        for ( const module of this.#modules ) module.printStatus();

        // XXX =================================================

        // for (const test of this.#failedTests) {
        //     console.log("");

        //     console.log(text.ansi.error(" ● "), "[T]", test.name);

        //     test.printLog();
        // }

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
}

const runner = global.SOFTVISIO_TESTS_RUNNER || new Runner();

if ( !global.SOFTVISIO_TESTS_RUNNER ) global.SOFTVISIO_TESTS_RUNNER = runner;

export { runner as default };
