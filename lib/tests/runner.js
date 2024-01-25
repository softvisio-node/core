import { ansi, Table } from "#lib/text";
import glob from "#lib/glob";
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
        const modules = glob( "**/*.js", {
            "cwd": url.fileURLToPath( path ),
            "directories": false,
        } );

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

    plan ( options ) {
        try {
            options = new Options( options );
        }
        catch ( e ) {
            return result.catch( e, { "silent": false, "keepError": false } );
        }

        const plan = [];

        for ( const module of this.#modules ) {
            const data = module.plan( options );

            if ( data ) plan.push( data );
        }

        // console text output
        if ( !options.json ) {
            for ( const module of plan ) {
                console.log( ansi.hl( `● ${ module.name }` ) );

                if ( options.level === 1 ) continue;

                for ( const test of module.tests ) {

                    // group
                    if ( test.isGroup ) {
                        const group = test;

                        console.log( `› ${ ansi.hl( group.name ) }` );

                        if ( options.level === 2 ) continue;

                        for ( const test of group.tests ) {
                            console.log( `    ${ test.name }` );
                        }
                    }

                    // top-level test
                    else {
                        console.log( `  ${ test.name }` );
                    }
                }
            }
        }

        return result( 200, plan );
    }

    async run ( options = {} ) {
        try {
            options = new Options( options );
        }
        catch ( e ) {
            return result.catch( e, { "silent": false, "keepError": false } );
        }

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

        // summary report
        this.#summaryReport( options, stat );

        // return status
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

    #summaryReport ( options, stat ) {
        console.log( `\n ${ ansi.hl( "● Summary Report:" ) }` );

        const table = new Table( {
            "console": true,
            "columnWidth": 8,
            "align": "right",
            "headerAlign": "center",
            "columns": {
                "name": { "width": 12, "align": "left", "margin": [ 1, 0 ] },
                "total": { "title": ansi.hl( "Total" ), "format": value => value || "-" },
                "skipped": { "title": ansi.hl( "Skip" ), "format": value => value || "-" },
                "ran": { "title": ansi.hl( "Ran" ), "format": value => value || "-" },
                "pass": { "title": ansi.ok( " PASS " ), "format": value => ( value ? ansi.ok( ` ${ value } ` ) : "-" ) },
                "fail": { "title": ansi.error( " FAIL " ), "format": value => ( value ? ansi.error( ` ${ value } ` ) : "-" ) },
            },
        } );

        table.add( {
            "name": "Modules",
            "total": stat.stat.totalModules,
            "skipped": stat.stat.skippedModules,
            "ran": stat.stat.ranModules,
            "pass": stat.stat.passModules,
            "fail": stat.stat.failModules,
        } );

        if ( !options.benchmarks ) {
            table.add( {
                "name": "Tests",
                "total": stat.stat.totalTests,
                "skipped": stat.stat.skippedTests,
                "ran": stat.stat.ranTests,
                "pass": stat.stat.passTests,
                "fail": stat.stat.failTests,
            } );
        }
        else {
            table.add( {
                "name": "Benchmarks",
                "total": stat.stat.totalBenchmarks,
                "skipped": stat.stat.skippedBenchmarks,
                "ran": stat.stat.ranBenchmarks,
                "pass": stat.stat.passBenchmarks,
                "fail": stat.stat.failBenchmarks,
            } );
        }

        table.end();
    }
}

const runner = global.SOFTVISIO_TESTS_RUNNER || new Runner();

if ( !global.SOFTVISIO_TESTS_RUNNER ) global.SOFTVISIO_TESTS_RUNNER = runner;

export { runner as default };
