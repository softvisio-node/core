function throwParsingError ( version ) {
    throw new Error( `Semantic version is not valid: "${ version }"` );
}

export default class SemanticVersion {
    #major;
    #minor;
    #patch;
    #preRelease;
    #preReleaseTags;
    #preReleaseTag;
    #preReleaseVersion;
    #build;
    #stableVersion;
    #version;

    constructor ( version ) {
        const match = /^v?(?<major>\d+)(?:\.(?<minor>\d+)(?:\.(?<patch>\d+)(?<meta>[+-].+)?)?)?$/.exec( String( version ) );

        if ( !match ) {
            throwParsingError( version );
        }

        this.#major = Number( match.groups.major );
        this.#minor = Number( match.groups.minor ?? 0 );
        this.#patch = Number( match.groups.patch ?? 0 );

        if ( match.groups.meta ) {
            let preRelease, build;

            // v1.0.0-alpha.1+build
            if ( match.groups.meta.startsWith( "-" ) ) {
                [ preRelease, build ] = match.groups.meta.slice( 1 ).split( "+", 2 );
            }

            // v1.0.0+build
            else {
                build = match.groups.meta.slice( 1 );
            }

            // pre-release
            if ( preRelease ) {
                const tags = preRelease.split( "." );

                for ( let n = 0; n < tags.length; n++ ) {
                    const tag = tags[ n ];

                    if ( !tag ) throwParsingError( version );

                    // numeric tag
                    if ( /^\d+$/.test( tag ) ) {
                        if ( tag !== "0" && tag.startsWith( "0" ) ) throwParsingError( version );

                        tags[ n ] = Number( tag );
                    }

                    // string tag
                    else if ( !/^[\dA-Za-z-]+$/.test( tag ) ) {
                        throwParsingError( version );
                    }
                }

                this.#preRelease = preRelease;
                this.#preReleaseTags = tags;
            }

            // build
            if ( build ) {
                if ( !/^[\dA-Za-z-]+(?:\.[\dA-Za-z-]+)*$/.test( build ) ) {
                    throwParsingError( version );
                }

                this.#build = build;
            }
        }
    }

    // static
    static new ( version ) {
        if ( version instanceof this ) {
            return version;
        }
        else {
            return new this( version );
        }
    }

    static isValid ( version ) {
        try {
            this.new( version );

            return true;
        }
        catch {
            return false;
        }
    }

    static get compare () {
        return ( a, b ) => this.new( a ).compare( b );
    }

    static get initialVersion () {
        return new this( "0" );
    }

    // properties
    get isMajor () {
        return Boolean( this.major && !this.minor && !this.patch );
    }

    get isMinor () {
        return Boolean( this.minor && !this.patch );
    }

    get isPatch () {
        return Boolean( this.patch || ( !this.major && !this.minor ) );
    }

    get isStableRelease () {
        return !this.isPreRelease;
    }

    get isPreRelease () {
        return Boolean( this.preRelease );
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

    get preReleaseTag () {
        if ( this.#preReleaseTag === undefined ) {
            this.#preReleaseTag = null;

            if ( this.preReleaseVersion != null ) {
                if ( typeof this.#preReleaseTags?.at( -2 ) === "string" ) {
                    this.#preReleaseTag = this.#preReleaseTags.at( -2 );
                }
            }
            else if ( typeof this.#preReleaseTags?.at( -1 ) === "string" ) {
                this.#preReleaseTag = this.#preReleaseTags.at( -1 );
            }
        }

        return this.#preReleaseTag;
    }

    get preReleaseVersion () {
        if ( this.#preReleaseVersion === undefined ) {
            this.#preReleaseVersion = null;

            if ( typeof this.#preReleaseTags?.at( -1 ) === "number" ) {
                this.#preReleaseVersion = this.#preReleaseTags.at( -1 );
            }
        }

        return this.#preReleaseVersion;
    }

    get build () {
        return this.#build;
    }

    get stableVersion () {
        if ( !this.#stableVersion ) {
            if ( this.isPreRelease ) {
                this.#stableVersion = new this.constructor( `${ this.#major }.${ this.#minor }.${ this.#patch }` );
            }
            else {
                this.#stableVersion = this;
            }
        }

        return this.#stableVersion;
    }

    get version () {
        if ( this.#version == null ) {
            this.#version = `${ this.#major }.${ this.#minor }.${ this.#patch }`;

            if ( this.#preRelease ) {
                this.#version += `-${ this.#preRelease }`;
            }

            if ( this.#build ) {
                this.#version += `+${ this.#build }`;
            }
        }

        return this.#version;
    }

    get versionString () {
        return "v" + this.toString();
    }

    // public
    toString () {
        return this.version;
    }

    toJSON () {
        return this.toString();
    }

    increment ( type, preReleaseTag ) {
        var version, preReleaseTagRequired;

        // major changed
        if ( type === "major" ) {

            // major-pre + major = major
            if ( this.isMajor && this.isPreRelease ) {
                version = this.stableVersion.version;
            }

            // major + major = major + 1
            else {
                version = `${ this.major + 1 }.0.0`;

                if ( this.isPreRelease ) {
                    preReleaseTagRequired = true;
                }
            }
        }

        // minor changes
        else if ( type === "minor" ) {

            // major + minor
            if ( this.isMajor ) {

                // 1.0.0-a.0 + 0.1.0 = 1.0.0-a.1
                if ( this.isPreRelease ) {
                    version = this.stableVersion.version;
                }

                // 1.0.0 + 0.1.0 = 1.1.0
                else {
                    version = `${ this.major }.1.0`;
                }
            }

            // minor + minor
            else if ( this.isMinor ) {

                // 1.1.0-a.0 + 0.1.0 = 1.1.0-a.1
                if ( this.isPreRelease ) {
                    version = this.stableVersion.version;
                }

                // 1.1.0 + 0.1.0 = 1.2.0
                else {
                    version = `${ this.major }.${ this.minor + 1 }.0`;
                }
            }

            // minor + patch
            else if ( this.isPatch ) {

                // 1.1.1-a.0 + 0.1.0 = 1.2.0-a.0
                if ( this.isPreRelease ) {
                    version = `${ this.major }.${ this.minor + 1 }.0`;

                    preReleaseTagRequired = true;
                }

                // 1.1.1 + 0.1.0 = 1.2.0
                else {
                    version = `${ this.major }.${ this.minor + 1 }.0`;
                }
            }
        }

        // patch changes
        else if ( type === "patch" ) {

            // major + patch
            if ( this.isMajor ) {

                // 1.0.0-a.0 + 0.0.1 = 1.0.0-a.1
                if ( this.isPreRelease ) {
                    version = this.stableVersion.version;
                }

                // 1.0.0 + 0.0.1 = 1.0.1
                else {
                    version = `${ this.major }.0.1`;
                }
            }

            // minor + patch
            else if ( this.isMinor ) {

                // 1.1.0-a.0 + 0.0.1 = 1.1.0-a.1
                if ( this.isPreRelease ) {
                    version = this.stableVersion.version;
                }

                // 1.1.0 + 0.0.1 = 1.1.1
                else {
                    version = `${ this.major }.${ this.minor }.1`;
                }
            }

            // patch + patch
            else if ( this.isPatch ) {

                // 1.1.1-a.0 + 0.0.1 = 1.1.1-a.1
                if ( this.isPreRelease ) {
                    version = this.stableVersion.version;
                }

                // 1.1.1 + 0.0.1 = 1.1.2
                else {
                    version = `${ this.major }.${ this.minor }.${ this.patch + 1 }`;
                }
            }
        }

        // type error
        else {
            throw new Error( "Increment type is not valid" );
        }

        // pre-release
        if ( this.isPreRelease ) {
            if ( preReleaseTag !== false ) {

                // preRelease is required
                if ( preReleaseTagRequired && !preReleaseTag ) {
                    throw new Error( `Pre-release tag is required` );
                }

                // set pre-release tag
                if ( preReleaseTag ) {
                    if ( !preReleaseTagRequired && preReleaseTag === this.preReleaseTag ) {
                        if ( this.preReleaseVersion != null ) {
                            version += "-" + preReleaseTag + "." + ( this.preReleaseVersion + 1 );
                        }
                        else {
                            version += "-" + preReleaseTag + ".0";
                        }
                    }
                    else {
                        version += "-" + preReleaseTag + ".0";
                    }
                }

                // inherit pre-release tag
                else {
                    if ( this.preReleaseVersion != null ) {
                        version += "-" + this.preReleaseTag + "." + ( this.preReleaseVersion + 1 );
                    }
                    else {
                        version += "-" + this.preReleaseTag + ".0";
                    }
                }
            }
        }

        // stable
        else {

            // stable + pre-release = stable-pre.0
            if ( preReleaseTag ) {
                version += "-" + preReleaseTag + ".0";
            }
        }

        version = this.constructor.new( version );

        // check, that new version > old version (required to compare pre-releases)
        if ( this.gte( version ) ) {
            throw new Error( `New version "${ version }" should be greater than old version "${ this }"` );
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
            return this.#comparePreRelease( version );
        }
    }

    eq ( version ) {
        return this.compare( this.constructor.new( version ) ) === 0;
    }

    ne ( version ) {
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

    [ Symbol.for( "nodejs.util.inspect.custom" ) ] ( depth, options, inspect ) {
        const spec = {
            "version": this.versionString,
        };

        return "SemanticVersion: " + inspect( spec );
    }

    // private
    #comparePreRelease ( version ) {
        const preRelease = version.preRelease?.split( "." );

        if ( this.preRelease ) {
            if ( preRelease ) {
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

                        // identifiers consisting of only digits are compared numerically
                        if ( typeof b === "number" ) {
                            if ( a < b ) {
                                return -1;
                            }
                            else if ( a > b ) {
                                return 1;
                            }
                        }

                        // identifiers with letters or hyphens are compared lexically in ASCII sort order
                        else {
                            return -1;
                        }
                    }

                    // identifiers with letters or hyphens are compared lexically in ASCII sort order
                    else if ( typeof b === "number" ) {
                        return 1;
                    }

                    // identifiers with letters or hyphens are compared lexically in ASCII sort order
                    else {
                        if ( a < b ) {
                            return -1;
                        }
                        else if ( a > b ) {
                            return 1;
                        }
                    }
                }

                // a larger set of pre-release fields has a higher precedence
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
}
