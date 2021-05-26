import _Test from "#lib/tests/test";
import runner from "#lib/tests/runner";

const INDENT = " ".repeat( 8 );

class Test extends _Test {
    #module;
    #group;
    #test;
    #timeout;

    #ok;
    #results = [];
    #consoleLog = [];
    #duration;

    constructor ( name, test, timeout, options = {} ) {
        super( name, options );

        this.#test = test;
        this.#timeout = timeout;
    }

    get isTest () {
        return true;
    }

    get type () {
        return "test";
    }

    get module () {
        return this.#module;
    }

    set module ( value ) {
        this.#module = value;
    }

    get group () {
        return this.#group;
    }

    set group ( value ) {
        this.#group = value;
    }

    get ok () {
        return this.#ok;
    }

    get duration () {
        return this.#duration;
    }

    // XXX filter by name pattern
    async run ( options ) {

        // filter
        if ( this.skip ) return this._skip();

        if ( !options.runTests ) return this._skip();

        // if ( this.#testNamePattern && !this.#testNamePattern.test( test.name ) ) throw "skip";

        // if (options.testNamePattern) {
        //     if (test.group) {
        //         if (!this.#testNamePattern.test(test.group.name)) throw "skip";
        //     } else {
        //         if (!this.#testNamePattern.test(test.name)) throw "skip";
        //     }
        // }

        // hook console.log
        const origConsoleLog = console.log;
        console.log = ( ...args ) => this.#consoleLog.push( args.join( " " ) );

        const t0 = process.hrtime.bigint();

        try {
            await this.#test();
        }
        catch ( e ) {
            this.addResult( result( 500 ) );
        }

        const t1 = process.hrtime.bigint();

        this.#duration = Number( t1 - t0 ) / 1000000;

        // restore console.log
        console.log = origConsoleLog;
    }

    addResult ( res ) {
        this.#results.push( res );

        if ( !res.ok ) this.#ok = false;
        else if ( this.#ok == null ) this.#ok = true;
    }

    printLog () {
        if ( this.ok ) return;

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

export default function test ( name, test, timeout ) {
    runner.addTest( new Test( name, test, timeout ) );
}

global.test = test;

Object.defineProperty( test, "skip", {
    value ( name, test, timeout ) {
        runner.addTest( new Test( name, test, timeout, { "skip": true } ) );
    },
} );
