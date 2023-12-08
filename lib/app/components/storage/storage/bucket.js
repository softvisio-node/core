import path from "node:path";

export default class {
    #storage;
    #location;
    #deduplicate;

    constructor ( storage, location, deduplicate ) {
        this.#storage = storage;
        this.#location = location;
        this.#deduplicate = deduplicate;
    }

    // properties
    get storage () {
        return this.#storage;
    }

    get location () {
        return this.#location;
    }

    get deduplicate () {
        return this.#deduplicate;
    }

    // public
    createImagePath ( filePath, hash ) {
        if ( !this.deduplicate ) return filePath;

        return path.pisix.join( path.dirname( filePath ), hash );
    }
}
