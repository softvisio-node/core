import * as text from "#lib/text";
import glob from "glob";
import url from "url";

const INDENT = " ".repeat( 4 );

class Module {
    #path;
    #name;

    constructor ( path, name ) {
        this.#path = path;
        this.#name = name;
    }

    get path () {
        return this.#path;
    }

    get name () {
        return this.#name;
    }
}

class Runner {
    #runTests = true;
    #runBenchmarks = true;
    #testPathPattern;
    #testNamePattern;

    #runManually;
    #queue = [];
    #module; // current loading module
    #context; // currently running test or benchmark

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

    // XXX
    async run ( options = {} ) {
        this.runTests = options.runTests;
        this.runBenchmarks = options.runBenchmarks;
        this.testPathPattern = options.testPathPattern;
        this.testNamePattern = options.testNamePattern;

        this.#run();
    }

    add ( test ) {
        if ( this.#module ) test.module = this.#module;

        this.#queue.push( test );

        if ( !this.#runManually ) this.#run();
    }

    addTestResult ( res ) {
        if ( !this.#context ) throw Error( `Expect outside test` );

        this.#context.addResult( res );
    }

    // private
    async #run () {
        if ( this.#context ) return;

        const test = this.#queue.shift();

        if ( !test ) return;

        // check, if test should be skipped
        try {
            if ( test.skip ) throw "skip";

            if ( this.#testPathPattern && test.module && !this.#testPathPattern.test( test.module.name ) ) throw "skip";

            if ( this.#testNamePattern && !this.#testNamePattern.test( test.name ) ) throw "skip";

            if ( test.isBenchmark && !this.#runBenchmarks ) throw "skip";

            if ( test.isTest && !this.#runTests ) throw "skip";
        }
        catch ( e ) {
            this.#onTestSkip( test );

            this.#run();

            return;
        }

        this.#context = test;

        await test.run();

        this.#context = null;

        this.#onTestEnd( test );

        this.#run();
    }

    #onTestSkip ( test ) {
        console.log( INDENT, text.ansi.dim( ` ○  skipped ${test.name}` ) );
    }

    #onTestEnd ( test ) {
        if ( test.isTest ) {
            if ( test.ok ) console.log( INDENT, text.ansi.ok( " √ " ), `${test.name} (${test.duration} ms)` );
            else {
                console.log( INDENT, text.ansi.error( " ● " ), text.ansi.hl( `${test.name} (${test.duration} ms)` ) );

                test.printLog();
            }
        }
        else if ( test.isBenchmark ) {
            console.log( text.ansi.ok( " done " ) );
        }
    }
}

export default new Runner();
