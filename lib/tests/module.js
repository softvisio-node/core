import Test from "#lib/tests/test";
import ansi from "#lib/text/ansi";

export default class Module extends Test {
    #path;

    #tests = [];

    #group; // currently loaded group
    #test; // current test

    constructor ( path, name ) {
        super( name, {} );

        this.#path = path;
    }

    get type () {
        return "module";
    }

    get label () {
        return "[m]";
    }

    get path () {
        return this.#path;
    }

    // public
    async load () {
        if ( this.isLoaded ) throw Error( `Module is already loaded` );

        this._setIsLoaded();

        if ( !this.#path ) return;

        try {
            await import( this.#path );
        }
        catch ( e ) {
            console.log( e );
        }
    }

    addTest ( test ) {
        if ( this.#group ) {
            this.#group.addTest( test );
        }

        // group
        else if ( test.isGroup ) {
            this.#tests.push( test );

            // set current group
            this.#group = test;

            // run group callback
            test.load();

            // undefine current group
            this.#group = null;
        }

        // test or benchmark
        else {
            this.#tests.push( test );
        }
    }

    async run ( options ) {
        if ( this.isTested ) throw Error( `Module is already tested` );

        this._setIsTested();

        // filter module by name pattern
        if ( options.testPathPattern && this.name && !options.testPathPattern.test( this.name ) ) return this._skip();

        for ( const test of this.#tests ) {
            this.#test = test;

            await test.run( options );

            this.#test = null;

            this._setResult( test.result );
        }
    }

    addTestResult ( res ) {
        if ( !this.#test ) throw Error( `Expect called outside of the test` );

        this.#test.addTestResult( res );
    }

    printStatus () {
        if ( this.result.status === 201 ) console.log( ansi.dim( " SKIP " ), this.label, this.name );
        else if ( this.result.ok ) console.log( ansi.ok( " PASS " ), this.label, this.name );
        else if ( !this.result.ok ) console.log( ansi.error( " FAIL " ), this.label, this.name );

        if ( this.result.status !== 201 ) for ( const test of this.#tests ) test.printStatus( 1 );
    }
}
