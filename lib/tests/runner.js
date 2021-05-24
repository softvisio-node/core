class Runner {
    #runTests = true;
    #runBenchmarks = true;
    #testPathPattern;
    #testNamePattern;

    #queue = [];
    #context; // currently running test or benchmark

    set runTests ( value ) {
        this.#runTests = !!value;
    }

    set runBenchmarks ( value ) {
        this.#runBenchmarks = !!value;
    }

    set testPathPattern ( value ) {
        if ( !value ) this.#testPathPattern = null;
        else this.#testPathPattern = new RegExp( `/${value}/`, "i" );
    }

    set testNamePattern ( value ) {
        if ( !value ) this.#testNamePattern = null;
        else this.#testNamePattern = new RegExp( `/${value}/`, "i" );
    }

    // public
    // XXX
    async run ( path, options = {} ) {
        this.runTests = options.runTests;
        this.runBenchmarks = options.runBenchmarks;
        this.testPathPattern = options.testPathPattern;
        this.testNamePattern = options.testNamePattern;
    }

    add ( item ) {
        if ( item.skip ) return this.#skip( item );

        if ( this.#testNamePattern && !item.name.match( this.#testNamePattern ) ) return this.#skip( item );

        if ( item.isBenchmark && !this.runBenchmarks ) return this.#skip( item );

        if ( item.isTest && !this.runTests ) return this.#skip( item );

        this.#queue.push( item );

        this.#run();
    }

    addTestResult ( res ) {
        if ( !this.#context ) throw Error( `Expect outside test` );

        this.#context.addResult( res );
    }

    // private
    async #run () {
        if ( this.#context ) return;

        const context = this.#queue.shift();

        if ( !context ) return;

        this.#context = context;

        await context.run();

        console.log( context.name, context.isFailed );

        this.#context = null;

        this.#run();
    }

    #skip ( item ) {
        console.log( `${item.type}: ${item.name} SKIPPED` );
    }
}

export default new Runner();
