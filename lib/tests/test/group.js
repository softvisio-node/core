import Test from "#lib/tests/test";
import runner from "#lib/tests/runner";
import ansi from "#lib/text/ansi";

class Group extends Test {
    #callback;

    #tests = [];
    #test; // currently running test

    constructor ( name, callback, options = {} ) {
        super( name, options );

        this.#callback = callback;
    }

    get isGroup () {
        return true;
    }

    get type () {
        return "group";
    }

    get label () {
        return "[g]";
    }

    // public
    load () {
        if ( this.isLoaded ) throw Error( `Group is already loaded` );

        this._setIsLoaded();

        const res = this.#callback();

        this.#callback = null;

        if ( res instanceof Promise ) throw `Describe callback must be synchronous`;
    }

    addTest ( test ) {
        if ( test.isGroup ) throw `Nested "describe" statements are not supported`;

        this.#tests.push( test );
    }

    async run ( options ) {
        if ( this.isTested ) throw Error( `Module is already tested` );

        this._setIsTested();

        // filter
        if ( this.skip ) return this._skip();

        if ( options.testNamePattern && !options.testNamePattern.test( this.name ) ) return this._skip();

        for ( const test of this.#tests ) {
            this.#test = test;

            await test.run( options, true );

            this.#test = null;

            this._setResult( test.result );
        }
    }

    addTestResult ( res ) {
        if ( !this.#test ) throw Error( `Expect called outside of the test` );

        this.#test.addTestResult( res );
    }

    printStatus ( indent ) {
        const indentSpace = "  ".repeat( indent || 0 );

        if ( this.result.status === 201 ) console.log( indentSpace, ansi.dim( " SKIP " ), this.label, this.name );
        else if ( this.result.ok ) console.log( indentSpace, ansi.ok( " PASS " ), this.label, this.name );
        else if ( !this.result.ok ) console.log( indentSpace, ansi.error( " FAIL " ), this.label, this.name );

        if ( this.result.status !== 201 ) for ( const test of this.#tests ) test.printStatus( indent + 1 );
    }
}

export default function describe ( name, callback ) {
    runner.addTest( new Group( name, callback ) );
}

global.describe = describe;

Object.defineProperty( describe, "skip", {
    value ( name, callback ) {
        describe( name, callback, { "skip": true } );
    },
} );
