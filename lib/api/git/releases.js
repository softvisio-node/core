import Release from "./release.js";

export default class Releases {
    #versions = [];
    #index = {};
    #firstStableVersion;
    #lastStableVersion;
    #firstPreReleaseVersion;
    #lastPreReleaseVersion;
    #lastPreRelease = {};

    constructor ( versions = [] ) {
        this.#versions = versions
            .map( version => {
                try {
                    version = new Release( version.version, {
                        "date": version.date,
                    } );

                    return version;
                }
                catch {}
            } )
            .filter( version => version )
            .sort( Release.compare );

        for ( const version of this.#versions ) {
            this.#index[ version.version ] = version;

            if ( version.isPreRelease ) {
                this.#firstPreReleaseVersion ||= version;
                this.#lastPreReleaseVersion = version;
            }
            else {
                this.#firstStableVersion ||= version;
                this.#lastStableVersion = version;
            }
        }
    }

    // properties
    get firstVersion () {
        return this.#versions[ 0 ];
    }

    get firstStableVersion () {
        return this.#firstStableVersion;
    }

    get firstPreReleaseVersion () {
        return this.#firstPreReleaseVersion;
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

    // public
    has ( version ) {
        return Boolean( this.#index[ Release.new( version ).version ] );
    }

    get ( version ) {
        return this.#index[ Release.new( version ).version ];
    }

    getLastPreReleaseVersion ( version ) {
        version = Release.new( version ).version;

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

    getPreviousVersion ( version, { stable } = {} ) {
        if ( !version ) {
            if ( stable ) {
                return this.firstStableVersion;
            }
            else {
                return this.firstVersion;
            }
        }
        else {
            version = Release.new( version );

            if ( !this.has( version ) ) return;

            for ( let n = this.#versions.length - 1; n >= 0; n-- ) {
                if ( this.#versions[ n ].version === version.version ) {
                    if ( stable ) {
                        for ( let m = n - 1; m >= 0; m-- ) {
                            if ( this.#versions[ m ].isStableRelease ) return this.#versions[ m ];
                        }

                        return;
                    }
                    else {
                        return this.#versions[ n - 1 ];
                    }
                }
            }
        }
    }

    getNextVersion ( version, { stable } = {} ) {
        if ( !version ) {
            if ( stable ) {
                return this.lastStableVersion;
            }
            else {
                return this.lastVersion;
            }
        }
        else {
            version = Release.new( version );

            if ( !this.has( version ) ) return;

            for ( let n = 0; n < this.#versions.length; n++ ) {
                if ( this.#versions[ n ].version === version.version ) {
                    if ( stable ) {
                        for ( let m = n + 1; m < this.#versions.length; m++ ) {
                            if ( this.#versions[ m ].isStableRelease ) return this.#versions[ m ];
                        }

                        return;
                    }
                    else {
                        return this.#versions[ n + 1 ];
                    }
                }
            }
        }
    }

    [ Symbol.iterator ] () {
        return this.#versions.values();
    }
}
