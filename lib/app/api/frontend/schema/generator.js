import FileTree from "#lib/file-tree";

export default class {
    #schema;
    #options;

    constructor ( schema, options ) {
        this.#schema = schema;
        this.#options = options;
    }

    // public
    async run () {
        const fileTree = new FileTree();

        return result( 200, fileTree );
    }
}
