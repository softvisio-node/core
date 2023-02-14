export default class {
    #schema;
    #options;

    constructor ( schema, options ) {
        this.#schema = schema;
        this.#options = options;
    }

    // public
    async run () {
        return result( 200 );
    }
}
