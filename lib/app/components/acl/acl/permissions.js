export default class {
    #permissions;
    #permissionsSet;

    constructor ( permissions ) {
        this.#permissions = permissions;
        this.#permissionsSet = new Set( permissions );
    }

    // public
    has ( permissions ) {
        if ( Array.isArray( permissions ) ) {
            for ( const permission of permissions ) {
                if ( this.#permissionsSet.has( permission ) ) return true;
            }
        }
        else if ( this.#permissionsSet.has( permissions ) ) {
            return true;
        }

        return false;
    }

    toJSON () {
        return this.#permissions;
    }

    [Symbol.iterator] () {
        return this.#permissionsSet.values();
    }
}
