import semver from "semver";

const DEFAULT_VERSION = "0.0.0";

class Range {
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

export default class Semver {
    #version;

    #isValid;
    #major;
    #minor;
    #patch;
    #prerelease;
    #release;

    constructor ( version ) {
        if ( !version ) {
            this.#version = DEFAULT_VERSION;
        }
        else if ( version.startsWith( "v" ) ) {
            this.#version = version.slice( 1 );
        }
        else {
            this.#version = version;
        }
    }

    // static
    static get Range () {
        return Range;
    }

    static new ( version ) {
        if ( version instanceof this ) return version;

        return new this( version );
    }

    static isValid ( version ) {
        return semver.valid( version ) != null;
    }

    static compare ( a, b ) {
        return semver.compare( a, b );
    }

    // properties
    get isNull () {
        return this.#version === DEFAULT_VERSION;
    }

    get isValid () {
        this.#isValid ??= semver.valid( this.#version ) != null;

        return this.#isValid;
    }

    get isMajor () {
        return this.major && !this.minor && !this.patch;
    }

    get isMinor () {
        return this.minor && !this.patch;
    }

    get isPatch () {
        return !!this.patch;
    }

    get isPreRelease () {
        return !!this.preRelease;
    }

    get major () {
        this.#major ??= semver.major( this.#version );

        return this.#major;
    }

    get minor () {
        this.#minor ??= semver.minor( this.#version );

        return this.#minor;
    }

    get patch () {
        this.#patch ??= semver.patch( this.#version );

        return this.#patch;
    }

    get preRelease () {
        this.#prerelease ??= ( semver.prerelease( this.#version ) || [] ).join( "." );

        return this.#prerelease;
    }

    get release () {
        if ( !this.#release ) {
            if ( this.isPreRelease ) {
                this.#release = new Semver( `${ this.major }.${ this.minor }.${ this.patch }` );
            }
            else {
                this.#release = this;
            }
        }

        return this.#release;
    }

    // public
    toString () {
        return this.#version;
    }

    toVersionString () {
        return "v" + this.#version;
    }

    toJSON () {
        return this.#version;
    }

    compare ( version ) {
        return semver.compare( this.#version, version + "" );
    }

    increment ( type, prereleaseTag ) {
        var version;

        if ( type === "prerelease" ) {
            version = new Semver( semver.inc( this.#version, type, prereleaseTag ) );
        }
        else {
            version = new Semver( semver.inc( this.#version, prereleaseTag
                ? "pre" + type
                : type, prereleaseTag ) );
        }

        return version;
    }

    eq ( version ) {
        return this.#version === version + "";
    }

    gt ( version ) {
        return semver.gt( this.#version, version + "" );
    }

    gte ( version ) {
        return semver.gte( this.#version, version + "" );
    }

    lt ( version ) {
        return semver.lt( this.#version, version + "" );
    }

    lte ( version ) {
        return semver.lte( this.#version, version + "" );
    }
}
