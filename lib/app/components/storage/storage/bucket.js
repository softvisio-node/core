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
    createImagePath ( path, hash ) {
        if ( !this.deduplicate ) return path;
    }
}
