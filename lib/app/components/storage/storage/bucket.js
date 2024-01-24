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
    get app () {
        return this.#storage.app;
    }

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

        return path.posix.join( this.location, hash.substring( 0, 2 ), hash.substring( 2, 4 ), hash );
    }
}
