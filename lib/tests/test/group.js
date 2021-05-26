import Test from "#lib/tests/test";
import runner from "#lib/tests/runner";

class Group extends Test {
    #callback;

    #isLoaded = false;

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

    // public
    load () {
        if ( this.#isLoaded ) throw Error( `Group is already loaded` );

        this.#isLoaded = true;

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
        }
    }

    addTestResult ( res ) {
        if ( !this.#test ) throw Error( `Expect called outside test` );

        this.#test.addTestResult( res );
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
