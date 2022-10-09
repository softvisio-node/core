export default class {
    #schema;

    constructor ( schema, options ) {
        this.#schema = schema;
    }

    // public
    async run () {
        return result( 200 );
    }
}
