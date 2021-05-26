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

    // XXX groups
    addTest ( test ) {

        // group
        if ( test.isGroup ) {
            if ( this.#group ) throw `Nested "describe" statements are not supported`;

            // set current group
            this.#group = test;

            // run group callback
            test.run();

            // undefine current group
            this.#group = null;
        }

        // test or benchmark
        else if ( test.isTest || test.isBenchmark ) {
            if ( this.#group ) test.group = this.#group;

            this.#tests.push( test );
        }

        // invalid test type
        else {
            throw `Test type is invalid`;
        }
    }

    addTestResult ( res ) {
        if ( !this.#test ) throw Error( `Expect called outside test` );

        this.#test.addResult( res );
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
}
