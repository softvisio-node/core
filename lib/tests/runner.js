import ansi from "#lib/text/ansi";
import glob from "glob";
import url from "url";
import Module from "#lib/tests/test/module";
import Options from "#lib/tests/options";
import Test from "#lib/tests/test";

class Runner {
    #modules = [];

    #isTested = false;

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

    async run ( options = {} ) {
        options = new Options( options );

        await this.#run( options );

        const stat = new Test();

        // status
        for ( const module of this.#modules ) {
            module.printStatus( options );

            stat.addStat( module );
        }

        // report
        for ( const module of this.#modules ) {
            module.printReport( options );
        }

        // finale report
        console.log( `\nModules:    fail: ${ansi.error( " " + stat.stat.failModules + " " )}, pass: ${ansi.ok( " " + stat.stat.passModules + " " )}, total: ${stat.stat.totalModules}, skipped: ${stat.stat.skippedModules}, ran: ${stat.stat.ranModules}` );

        if ( options.runTests ) console.log( `Tests:      fail: ${ansi.error( " " + stat.stat.failTests + " " )}, pass: ${ansi.ok( " " + stat.stat.passTests + " " )}, total: ${stat.stat.totalTests}, skipped: ${stat.stat.skippedTests}, ran: ${stat.stat.ranTests}` );

        if ( options.runBenchmarks ) console.log( `Benchmarks: fail: ${ansi.error( " " + stat.stat.failBenchmarks + " " )}, pass: ${ansi.ok( " " + stat.stat.passBenchmarks + " " )}, total: ${stat.stat.totalBenchmarks}, skipped: ${stat.stat.skippedBenchmarks}, ran: ${stat.stat.ranBenchmarks}` );

        if ( stat.stat.failModules ) return result( 500 );
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
