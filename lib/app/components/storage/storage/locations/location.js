export default class Location {
    #location;
    #private;
    #encrypt;
    #cacheControl;
    #maxAge;
    #inactiveMaxAge;

    constructor ( location, parentLocation, { "private": isPrivate, encrypt, cacheControl, maxAge, inactiveMaxAge } = {} ) {
        this.#location = location;

        if ( isPrivate == null ) {
            if ( parentLocation ) {
                this.#private = parentLocation.isPrivate;
            }
            else {
                this.#private = true;
            }
        }
        else {
            this.#private = !!isPrivate;
        }

        if ( encrypt == null ) {
            if ( parentLocation ) {
                this.#encrypt = parentLocation.encrypt;
            }
            else {
                this.#encrypt = false;
            }
        }
        else {
            this.#encrypt = !!encrypt;
        }

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
