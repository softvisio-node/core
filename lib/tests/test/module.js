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

    get isModule () {
        return true;
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

    plan ( options ) {

        // filter module by name pattern
        if ( options.modulePattern && this.name && !options.modulePattern.test( this.name ) ) return;

        const plan = {
            "name": this.name,
            "tests": [],
        };

        for ( const test of this.#tests ) {
            const data = test.plan( options, this );

            if ( data ) plan.tests.push( data );
        }

        if ( !plan.tests.length ) return;

        return plan;
    }

    async run ( options ) {
        if ( this.isTested ) throw Error( `Module is already tested` );

        this._setIsTested();

        // filter module by name pattern
        if ( options.modulePattern && this.name && !options.modulePattern.test( this.name ) ) this._skip( "filtered" );

        for ( const test of this.#tests ) {
            this.#test = test;

            await test.run( options, this );

            this.#test = null;

            this._setResult( test.result );

            this.addStat( test );
        }

        // set kipped status based on skipped sub-tests
        if ( !this.stat.total ) this._skip( "no tests to run" );
        else if ( this.stat.total === this.stat.totalSkipped ) this._skip( "all tests were skipped" );
    }

    addTestResult ( res ) {
        if ( !this.#test ) throw Error( `Expect called outside of the test` );

        this.#test.addTestResult( res );
    }

    printStatus ( options ) {
        if ( this.isSkipped ) {
            if ( options.showSkipped ) console.log( `${ ansi.dark( " ● SKIP " ) } ${ ansi.hl( this.name ) } ${ this._formatStatusText( this.result.statusText ) }` );
        }
        else if ( this.result.ok ) {
            console.log( `${ ansi.ok( " ● PASS " ) } ${ ansi.hl( this.name ) }` );
        }
        else {
            console.log( `${ ansi.error( " ● FAIL " ) } ${ ansi.hl( this.name ) }` );
        }

        if ( options.verbose ) for ( const test of this.#tests ) test.printStatus( options, this );
    }

    printReport ( options ) {
        if ( !this.isSkipped ) for ( const test of this.#tests ) test.printReport( options, this.name );
    }
}
