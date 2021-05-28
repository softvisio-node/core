import { ansi, Table } from "#lib/text";
import glob from "glob";
import url from "url";
import Module from "#lib/tests/test/module";
import Options from "#lib/tests/options";
import Test from "#lib/tests/test";

class Runner {
    #globalsExported;
    #isTested = false;

    #modules = [];
    #module; // current module

    // public
    async loadModules ( path ) {

        // read modules list
        const modules = glob.sync( "**/*.js", { "cwd": url.fileURLToPath( path ), "nodir": true } );

        for ( const modulePath of modules ) {
            await this.loadModule( path + "/" + modulePath, modulePath );
        }
    }

    async loadModule ( path, name ) {

        // export global functions
        await this.#exportGlobals();

        const module = new Module( path, name );

        this.#addModule( module );

        await this.#loadModule( module );
    }

    plan ( options = {}, print ) {
        options = new Options( options );

        const plan = [];

        for ( const module of this.#modules ) {
            const data = module.plan( options );

            if ( data ) plan.push( data );
        }

        if ( print ) {
            for ( const module of plan ) {
                console.log( ansi.hl( `● ${module.name}` ) );

                for ( const test of module.tests ) {
                    if ( test.isGroup ) {
                        const group = test;

                        console.log( ` › ${ansi.hl( group.name )}` );

                        for ( const test of group.tests ) {
                            console.log( `    ${test.name}` );
                        }
                    }
                    else {
                        console.log( `    ${test.name}` );
                    }
                }
            }
        }

        return plan;
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

        // final report
        console.log( "\n ● Total Report" );

        const table = new Table( {
            "console": true,
            "width": 8,
            "align": "right",
            "headerAlign": "center",
            "columns": {
                "name": { "width": 12, "align": "left", "margin": [1, 0] },
                "fail": { "title": "Fail", "format": value => ansi.error( ` ${value} ` ) },
                "pass": { "title": "Pass", "format": value => ansi.ok( ` ${value} ` ) },
                "total": { "title": "Total" },
                "skipped": { "title": "Skip" },
                "run": { "title": "Ran" },
            },
        } );

        table.add( ["Modules", stat.stat.failModules, stat.stat.passModules, stat.stat.totalModules, stat.stat.skippedModules, stat.stat.ranModules] );

        if ( !options.benchmarks ) {
            table.add( ["Tests", stat.stat.failTests, stat.stat.passTests, stat.stat.totalTests, stat.stat.skippedTests, stat.stat.ranTests] );
        }
        else {
            table.add( ["Benchmarks", stat.stat.failBenchmarks, stat.stat.passBenchmarks, stat.stat.totalBenchmarks, stat.stat.skippedBenchmarks, stat.stat.ranBenchmarks] );
        }

        table.end();

        if ( stat.stat.failModules ) return result( 500 );
        else return result( 200 );
    }

    addTest ( test ) {
        if ( this.#isTested ) throw Error( `Nested tests are not supported` );

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
    async #exportGlobals () {
        if ( this.#globalsExported ) return;

        this.#globalsExported = true;

        const tests = await import( "#lib/tests" );
        global.test = tests.test;
        global.expect = tests.expect;
        global.bench = tests.bench;
        global.describe = tests.describe;
    }

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
