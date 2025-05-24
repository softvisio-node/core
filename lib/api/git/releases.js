import SemanticVersion from "#lib/semantic-version";

export default class Releases {
    #versions = {};
    #lastVersion;
    #lastStableVersion;
    #lastPreRelease = {};

    constructor ( releases = [] ) {
        for ( const release of releases ) {
            const version = SemanticVersion.new( release, {
                "throwErrors": false,
            } );

            if ( !version ) continue;

            this.#versions[ version ] = version;

            if ( !this.#lastVersion || version.gt( this.#lastVersion ) ) this.#lastVersion = version;

            if ( !version.isPreRelease && ( !this.#lastStableVersion || version.gt( this.#lastStableVersion ) ) ) this.#lastStableVersion = version;
        }

        this.#lastVersion ??= new SemanticVersion();
        this.#lastStableVersion ??= new SemanticVersion();
    }

    // properties
    get lastVersion () {
        return this.#lastVersion;
    }

    get lastStableVersion () {
        return this.#lastStableVersion;
    }

    get versions () {
        return Object.values( this.#versions );
    }

    // public
    has ( version ) {
        return !!this.#versions[ version ];
    }

    get ( version ) {
        return this.#versions[ version ];
    }

    getLastPreRelease ( version ) {
        if ( this.#lastPreRelease[ version ] === undefined ) {
            let latestPreRelease;

            for ( const _version of this.versions ) {

                // version is the pre-release of the new version
                if ( _version.isPreRelease && _version.release.eq( version.release ) ) {

                    // version is the latest pre-release of the new version
                    if ( !latestPreRelease || _version.gt( latestPreRelease ) ) latestPreRelease = _version;
                }
            }

            this.#lastPreRelease[ version ] = latestPreRelease || null;
        }

        return this.#lastPreRelease[ version ];
    }
}
