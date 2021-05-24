import * as text from "#lib/text";

const INDENT = " ".repeat( 4 );

class Runner {
    #runTests = true;
    #runBenchmarks = true;
    #testPathPattern;
    #testNamePattern;

    #queue = [];
    #context; // currently running test or benchmark

    set runTests ( value ) {
        this.#runTests = !!value;
    }

    set runBenchmarks ( value ) {
        this.#runBenchmarks = !!value;
    }

    set testPathPattern ( value ) {
        if ( !value ) this.#testPathPattern = null;
        else this.#testPathPattern = new RegExp( `/${value}/`, "i" );
    }

    set testNamePattern ( value ) {
        if ( !value ) this.#testNamePattern = null;
        else this.#testNamePattern = new RegExp( `/${value}/`, "i" );
    }

    // public
    // XXX
    async run ( path, options = {} ) {
        this.runTests = options.runTests;
        this.runBenchmarks = options.runBenchmarks;
        this.testPathPattern = options.testPathPattern;
        this.testNamePattern = options.testNamePattern;
    }

    add ( test ) {
        this.#queue.push( test );

        this.#run();
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
