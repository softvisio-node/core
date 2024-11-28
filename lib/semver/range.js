import semver from "semver";

export default class SemverRange {
    #range;
    #isPreRelease;

    constructor ( range ) {
        this.#range = range;
    }

    // properties
    get isPreRelease () {
        if ( this.#isPreRelease == null ) this.#isPreRelease = !!semver.minVersion( this.#range ).prerelease.length;

        return this.#isPreRelease;
    }

    // public
    toString () {
        return this.#range;
    }

    toJSON () {
        return this.#range;
    }
}
