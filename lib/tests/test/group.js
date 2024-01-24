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

    plan ( options, parent ) {

        // filter
        if ( this.skip ) return;
        else if ( options.firstLevelPattern && !options.firstLevelPattern.test( this.name ) ) return;

        const plan = {
            "name": this.name,
            "isGroup": true,
            "tests": [],
        };

        for ( const test of this.#tests ) {
            const data = test.plan( options, this );

            if ( data ) plan.tests.push( data );
        }

        if ( !plan.tests.length ) return;

        return plan;
    }

    async run ( options, parent ) {
        if ( this.isTested ) throw Error( `Module is already tested` );

        this._setIsTested();

        // filter
        if ( parent.isSkipped ) this._skip( "parent skipped" );
        else if ( this.skip ) this._skip( "filtered" );
        else if ( options.firstLevelPattern && !options.firstLevelPattern.test( this.name ) ) this._skip( "filtered" );

        for ( const test of this.#tests ) {
            this.#test = test;

            await test.run( options, this );

            this.#test = null;

            this._setResult( test.result );

            this.addStat( test );
        }

        // set kipped status based on skipped sub-tests
        if ( !this.isSkipped ) {
            if ( !this.stat.total ) this._skip( "no tests to run" );
            else if ( this.stat.total === this.stat.totalSkipped ) this._skip( "all tests were skipped" );
        }
    }

    addTestResult ( res ) {
        if ( !this.#test ) throw Error( `Expect called outside of the test` );

        this.#test.addTestResult( res );
    }

    printStatus ( options, parent ) {
        if ( this.isSkipped ) {
            if ( options.showSkipped ) console.log( ` › ${ ansi.hl( this.name ) } ${ this._formatStatusText( this.result.statusText ) }` );
        }
        else if ( this.result.ok ) {
            if ( options.showPassed ) console.log( ` › ${ ansi.hl( this.name ) }` );
        }
        else {
            console.log( ` › ${ ansi.hl( this.name ) }` );
        }

        for ( const test of this.#tests ) test.printStatus( options, this );
    }

    printReport ( options, parent ) {
        parent = ( parent ? parent + " › " : "" ) + this.name;

        if ( !this.isSkipped ) for ( const test of this.#tests ) test.printReport( options, parent );
    }
}

export default function describe ( name, callback ) {
    runner.addTest( new Group( name, callback ) );
}

Object.defineProperty( describe, "skip", {
    value ( name, callback ) {
        describe( name, callback, { "skip": true } );
    },
} );
