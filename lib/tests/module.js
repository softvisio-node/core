export default class Module {
    #path;
    #name;
    #tests = [];
    #isLoaded;
    #isDone;
    #isSkipped;

    #group; // currently loaded group
    #test; // currently running test

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
        if ( this.#isLoaded ) return;

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
        if ( this.#isDone ) return;

        this.#isDone = true;

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
