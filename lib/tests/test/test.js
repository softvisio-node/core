import _Test from "#lib/tests/test";
import runner from "#lib/tests/runner";
import ansi from "#lib/text/ansi";

const LABEL = ansi.dim( "[test]" );
const INDENT = " ".repeat( 8 );

class Test extends _Test {
    #callback;
    #timeout;

    #results = [];
    #consoleLog = [];
    #duration;

    constructor ( name, callback, timeout, options = {} ) {
        super( name, options );

        this.#callback = callback;
        this.#timeout = timeout;
    }

    get isTest () {
        return true;
    }

    get duration () {
        return this.#duration;
    }

    async run ( options, skipNameFilter ) {
        if ( this.isTested ) throw Error( `Test is already tested` );

        this._setIsTested();

        // filter
        if ( this.skip ) return this._skip( "filtered" );

        if ( !options.runTests ) return this._skip( "filtered" );

        if ( !skipNameFilter && options.testNamePattern && !options.testNamePattern.test( this.name ) ) return this._skip( "filtered" );

        // hook console.log
        const origConsoleLog = console.log;
        console.log = ( ...args ) => this.#consoleLog.push( args.join( " " ) );

        const t0 = process.hrtime.bigint();

        try {
            await this.#callback();
        }
        catch ( e ) {
            this.addTestResult( result( 500 ) );
        }

        const t1 = process.hrtime.bigint();

        this.#duration = Number( t1 - t0 ) / 1000000;

        this.#callback = null;

        // restore console.log
        console.log = origConsoleLog;

        // no expect function was called in the test body
        if ( !this.result ) this.addTestResult( [500, `No expect was called`] );
    }

    addTestResult ( res ) {
        this.#results.push( res );

        if ( res.ok ) this._setResult( result( 200 ) );
        else this._setResult( result( 500 ) );
    }

    printStatus ( options ) {
        if ( !options.runTests ) return;

        if ( this.isSkipped ) {
            if ( options.showSkipped ) console.log( `     ${ansi.dark( "○" )} ${LABEL} ${this.name} (${this.result.reason})` );
        }
        else if ( this.result.ok ) {
            if ( options.showPassed ) console.log( `     ${ansi.brightGreen( "√" )} ${LABEL} ${this.name} (${this.duration} ms)` );
        }
        else if ( !this.result.ok ) {
            console.log( `     ${ansi.brightRed( "×" )} ${LABEL} ${this.name} (${this.duration} ms)` );
        }
    }

    // XXX
    printReport ( options ) {
        if ( this.isSkipped || this.result ) return;

        for ( const res of this.#results ) {
            if ( res.ok ) continue;

            const data = res.data;

            console.log( "\n", INDENT, "expect:", data.name );

            data.error.stack
                .split( "\n" )
                .splice( 3 )
                .forEach( line => console.log( INDENT, line ) );
        }

        console.log( "" );
    }
}

export default function test ( name, callback, timeout ) {
    runner.addTest( new Test( name, callback, timeout ) );
}

global.test = test;

Object.defineProperty( test, "skip", {
    value ( name, callback, timeout ) {
        test( name, callback, timeout, { "skip": true } );
    },
} );
