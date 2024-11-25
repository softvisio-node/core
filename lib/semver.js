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

function throwParsingError ( version ) {
    throw new Error( `Semantic version is not valid: "${ version }"` );
}

export default class Semver {
    #major;
    #minor;
    #patch;
    #preRelease;
    #preReleaseTags;
    #build;
    #release;
    #toString;

    constructor ( version ) {
        if ( !version ) {
            this.#major = 0;
            this.#minor = 0;
            this.#patch = 0;
        }
        else {
            const match = /^v?(?<major>\d+)(?:\.(?<minor>\d+)(?:\.(?<patch>\d+)(?<meta>[+-].+)?)?)?$/.exec( version );

            if ( !match ) {
                throwParsingError( version );
            }

            this.#major = Number( match.groups.major );
            this.#minor = Number( match.groups.minor ?? 0 );
            this.#patch = Number( match.groups.patch ?? 0 );

            if ( match.groups.meta ) {
                let preRelease, build;

                if ( match.groups.meta.startsWith( "-" ) ) {
                    [ preRelease, build ] = match.groups.meta.slice( 1 ).split( "+", 2 );
                }
                else {
                    build = match.groups.meta.slice( 1 );
                }

                if ( preRelease ) {
                    const tags = preRelease.split( "." );

                    for ( let n = 0; n < tags.length; n++ ) {
                        const tag = tags[ n ];

                        if ( !tag ) throwParsingError( version );

                        if ( /^\d+$/.test( tag ) ) {
                            if ( tag.startsWith( "0" ) ) throwParsingError( version );

                            tags[ n ] = Number( tag );
                        }
                        else if ( !/^[\dA-Za-z-]+$/.test( tag ) ) {
                            throwParsingError( version );
                        }
                    }

                    this.#preRelease = preRelease;
                    this.#preReleaseTags = tags;
                }

                if ( build ) {
                    if ( !/^[\dA-Za-z-]+(?:\.[\dA-Za-z-]+)*$/.test( build ) ) {
                        throwParsingError( version );
                    }

                    this.#build = build;
                }
            }
        }
    }

    // static
    static get Range () {
        return Range;
    }

    static new ( version, { throwError = true } = {} ) {
        if ( version instanceof this ) {
            return version;
        }
        else if ( throwError ) {
            return new this( version );
        }
        else {
            try {
                return new this( version );
            }
            catch {
                return null;
            }
        }
    }

    static isValid ( version ) {
        return (
            this.new( version, {
                "throwError": false,
            } ) != null
        );
    }

    static get compare () {
        return ( a, b ) =>
            this.new( a, {
                "throwError": true,
            } ).compare( b );
    }

    // properties
    get isNull () {
        return this.toString() === DEFAULT_VERSION;
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
        return this.#major;
    }

    get minor () {
        return this.#minor;
    }

    get patch () {
        return this.#patch;
    }

    get preRelease () {
        return this.#preRelease;
    }

    get build () {
        return this.#build;
    }

    get release () {
        if ( !this.#release ) {
            if ( this.isPreRelease ) {
                this.#release = new this.constructor( `${ this.#major }.${ this.#minor }.${ this.#patch }` );
            }
            else {
                this.#release = this;
            }
        }

        return this.#release;
    }

    // public
    toString () {
        if ( this.#toString == null ) {
            this.#toString = `${ this.#major }.${ this.#minor }.${ this.#patch }`;

            if ( this.#preRelease ) {
                this.#toString += `-${ this.#preRelease }`;
            }

            if ( this.#build ) {
                this.#toString += `+${ this.#build }`;
            }
        }

        return this.#toString;
    }

    toVersionString () {
        return "v" + this.toString();
    }

    toJSON () {
        return this.toString();
    }

    // XXX
    increment ( type, prereleaseTag ) {
        var version;

        if ( type === "prerelease" ) {
            version = new this.constructor( semver.inc( this.toString(), type, prereleaseTag ) );
        }
        else {
            version = new this.constructor( semver.inc( this.toString(), prereleaseTag
                ? "pre" + type
                : type, prereleaseTag ) );
        }

        return version;
    }

    compare ( version ) {
        version = this.constructor.new( version );

        if ( this.major < version.major ) {
            return -1;
        }
        else if ( this.major > version.major ) {
            return 1;
        }
        else if ( this.minor < version.minor ) {
            return -1;
        }
        else if ( this.minor > version.minor ) {
            return 1;
        }
        else if ( this.patch < version.patch ) {
            return -1;
        }
        else if ( this.patch > version.patch ) {
            return 1;
        }
        else {
            const cmp = version.comparePreRelease( this.#preReleaseTags );

            if ( cmp === -1 ) {
                return 1;
            }
            else if ( cmp === 1 ) {
                return -1;
            }
            else {
                return 0;
            }
        }
    }

    comparePreRelease ( preRelease ) {
        if ( Array.isArray( preRelease ) && !preRelease.length ) {
            preRelease = null;
        }

        if ( this.preRelease ) {
            if ( preRelease ) {
                if ( !Array.isArray( preRelease ) ) {
                    preRelease = preRelease.split( "." );
                }

                const length = Math.min( this.#preReleaseTags.length, preRelease.length );

                let n = 0;

                for ( ; n < length; n++ ) {
                    const a = this.#preReleaseTags[ n ];

                    let b = preRelease[ n ];

                    if ( typeof b !== "number" ) {
                        b = Number( b );

                        if ( Number.isNaN( b ) ) {
                            b = preRelease[ n ];
                        }
                    }

                    if ( typeof a === "number" ) {

                        // Identifiers consisting of only digits are compared numerically
                        if ( typeof b === "number" ) {
                            if ( a < b ) {
                                return -1;
                            }
                            else if ( a > b ) {
                                return 1;
                            }
                        }

                        // Identifiers with letters or hyphens are compared lexically in ASCII sort order
                        else {
                            return -1;
                        }
                    }

                    // Identifiers with letters or hyphens are compared lexically in ASCII sort order
                    else if ( typeof b === "number" ) {
                        return 1;
                    }

                    // Identifiers with letters or hyphens are compared lexically in ASCII sort order
                    else {
                        if ( a < b ) {
                            return -1;
                        }
                        else if ( a > b ) {
                            return 1;
                        }
                    }
                }

                // A larger set of pre-release fields has a higher precedence
                // than a smaller set, if all of the preceding identifiers are equal
                if ( preRelease.length > n ) {
                    return -1;
                }
                else if ( this.#preReleaseTags.length > n ) {
                    return 1;
                }
                else {
                    return 0;
                }
            }
            else {
                return -1;
            }
        }
        else if ( preRelease ) {
            return 1;
        }
        else {
            return 0;
        }
    }

    eq ( version ) {
        return this.compare( this.constructor.new( version ) ) === 0;
    }

    neq ( version ) {
        return this.compare( this.constructor.new( version ) ) !== 0;
    }

    gt ( version ) {
        return this.compare( this.constructor.new( version ) ) === 1;
    }

    gte ( version ) {
        return this.compare( this.constructor.new( version ) ) >= 0;
    }

    lt ( version ) {
        return this.compare( this.constructor.new( version ) ) === -1;
    }

    lte ( version ) {
        return this.compare( this.constructor.new( version ) ) <= 0;
    }
}
