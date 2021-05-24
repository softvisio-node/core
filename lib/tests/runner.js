class Runner {
    #testsToRun = [];
    #benchmarksToRun = [];
    #context; // currently running test or benchmark

    // public
    // XXX
    async runTest () {}

    // XXX
    addGroup ( group ) {}

    addTest ( test ) {
        this.#testsToRun.push( test );

        this.#run();
    }

    addBenchmark ( benchmark ) {
        this.#benchmarksToRun.push( benchmark );

        this.#run();
    }

    addTestResult ( res ) {
        if ( !this.#context ) throw Error( `Expect outside test` );

        this.#context.addResult( res );
    }

    // private
    async #run () {
        if ( this.#context ) return;

        const context = this.#testsToRun.shift() || this.#benchmarksToRun.shift();

        if ( !context ) return;

        this.#context = context;

        await context.run();

        console.log( context.name, context.isFailed );

        this.#context = null;

        this.#run();
    }
}

export default new Runner();
