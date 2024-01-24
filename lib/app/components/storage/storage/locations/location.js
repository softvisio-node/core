export default class Location {
    #location;
    #private;
    #encrypt;
    #cacheControl;
    #maxAge;
    #inactiveMaxAge;

    constructor ( location, parentLocation, { "private": isPrivate, encrypt, cacheControl, maxAge, inactiveMaxAge } = {} ) {
        this.#location = location;

        this.#private = !!( isPrivate ?? parentLocation?.isPrivate );
        this.#encrypt = !!( encrypt ?? parentLocation?.encrypt );
        this.#cacheControl = cacheControl ?? parentLocation?.cacheControl;
        this.#maxAge = maxAge ?? parentLocation?.maxAge;
        this.#inactiveMaxAge = inactiveMaxAge ?? parentLocation?.inactiveMaxAge;
    }

    // properties
    get location () {
        return this.#location;
    }

    get isPrivate () {
        return this.#private;
    }

    get encrypt () {
        return this.#encrypt;
    }

    get cacheControl () {
        return this.#cacheControl;
    }

    get maxAge () {
        return this.#maxAge;
    }

    get inactiveMaxAge () {
        return this.#inactiveMaxAge;
    }
}
