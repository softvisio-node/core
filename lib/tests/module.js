export default class Module {
    #path;
    #name;

    #isLoaded = false;
    #isTested = false;
    #isSkipped = false;

    #tests = [];

    #group; // currently loaded group
    #test; // current test

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

    // public
    async load () {
        if ( this.#isLoaded ) throw Error( `Module is already loaded` );

        this.#isLoaded = true;

        if ( !this.#path ) return;

        try {
            await import( this.#path );
        }
        catch ( e ) {
            console.log( e );
        }
    }

    addTest ( test ) {
        if ( this.#isTested ) throw Error( `Nested tests are not supported` );

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
        if ( this.#isTested ) throw Error( `Module is already tested` );

        this.#isTested = true;

        // filter module by name pattern
        if ( options.testPathPattern && this.name && !options.testPathPattern.test( this.name ) ) {
            this.#isSkipped = true;

            return;
        }

        for ( const test of this.#tests ) {
            this.#test = test;

            await test.run( options );

            this.#test = null;
        }
    }

    addTestResult ( res ) {
        if ( !this.#test ) throw Error( `Expect called outside test` );

        this.#test.addTestResult( res );
    }
}
