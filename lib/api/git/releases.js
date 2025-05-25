import SemanticVersion from "#lib/semantic-version";

export default class Releases {
    #versions = [];
    #index = {};
    #lastStableVersion;
    #lastPreReleaseVersion;
    #lastPreRelease = {};

    constructor ( versions = [] ) {
        this.#versions = versions
            .map( version =>
                SemanticVersion.new( version, {
                    "throwErrors": false,
                } ) )
            .filter( version => version )
            .sort( SemanticVersion.compare );

        for ( const version of this.#versions ) {
            this.#index[ version.version ] = version;

            if ( version.isPreRelease ) {
                this.#lastPreReleaseVersion = version;
            }
            else {
                this.#lastStableVersion = version;
            }
        }
    }

    // properties
    get firstVersion () {
        return this.#versions[ 0 ];
    }

    get lastVersion () {
        return this.#versions.at( -1 );
    }

    get lastStableVersion () {
        return this.#lastStableVersion;
    }

    get lastPreReleaseVersion () {
        return this.#lastPreReleaseVersion;
    }

    get versions () {
        return this.#versions.values();
    }

    // public
    has ( version ) {
        return Boolean( this.#index[ SemanticVersion.new( version ).version ] );
    }

    get ( version ) {
        return this.#index[ SemanticVersion.new( version ).version ];
    }

    // XXX
    getLastPreRelease ( version ) {
        version = SemanticVersion.new( version ).version;

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

    // XXX
    getPreviousVersion ( version, { stable } = {} ) {}

    // XXX
    getNextVersion ( version, { stable } = {} ) {
        version = SemanticVersion.new( version ).version;

        if ( !this.has( version ) ) return;

        for ( let n = 0; n < this.#versions; n++ ) {
            if ( this.#versions[ n ].version === version ) return this.#versions[ n + 1 ];
        }
    }
}
