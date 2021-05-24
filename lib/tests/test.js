import runner from "#lib/tests/runner";

const INDENT = " ".repeat( 8 );

class Test {
    #name;
    #test;
    #timeout;
    #skip;

    #ok;
    #results = [];
    #consoleLog = [];

    constructor ( name, test, timeout, options = {} ) {
        this.#name = name;
        this.#test = test;
        this.#timeout = timeout;

        this.#skip = !!options.skip;
    }

    get isTest () {
        return true;
    }

    get type () {
        return "test";
    }

    get name () {
        return this.#name;
    }

    get skip () {
        return this.#skip;
    }

    get ok () {
        return this.#ok;
    }

    // XXX
    async run () {

        // hook console.log
        const origConsoleLog = console.log;
        console.log = ( ...args ) => this.#consoleLog.push( args.join( " " ) );

        try {
            await this.#test();
        }
        catch ( e ) {
            this.addResult( result( 500 ) );
        }

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
    runner.add( new Test( name, test, timeout ) );
}

global.test = test;

Object.defineProperty( test, "skip", {
    value ( name, test, timeout ) {
        runner.add( new Test( name, test, timeout, { "skip": true } ) );
    },
} );
