import GitRelease from "./release.js";

export default class GitReleases {
    #versions = [];
    #index = {};
    #firstStableRelease;
    #lastStableRelease;
    #firstPreRelease;
    #lastPreRelease;
    #lastPreRelease1 = {};

    constructor ( versions = [] ) {
        this.#versions = versions
            .map( version => {
                try {
                    version = new GitRelease( version.version, {
                        "date": version.date,
                    } );

                    return version;
                }
                catch {}
            } )
            .filter( version => version )
            .sort( GitRelease.compare );

        for ( const version of this.#versions ) {
            this.#index[ version.version ] = version;

            if ( version.isPreRelease ) {
                this.#firstPreRelease ||= version;
                this.#lastPreRelease = version;
            }
            else {
                this.#firstStableRelease ||= version;
                this.#lastStableRelease = version;
            }
        }
    }

    // properties
    get firstRelease () {
        return this.#versions[ 0 ];
    }

    get firstStableRelease () {
        return this.#firstStableRelease;
    }

    get firstPreRelease () {
        return this.#firstPreRelease;
    }

    get lastRelease () {
        return this.#versions.at( -1 );
    }

    get lastStableRelease () {
        return this.#lastStableRelease;
    }

    get lastPreRelease () {
        return this.#lastPreRelease;
    }

    // public
    has ( version ) {
        return Boolean( this.#index[ GitRelease.new( version ).version ] );
    }

    get ( version ) {
        return this.#index[ GitRelease.new( version ).version ];
    }

    getLastPreRelease ( version ) {
        version = GitRelease.new( version ).version;

        if ( this.#lastPreRelease1[ version ] === undefined ) {
            let latestPreRelease;

            for ( const _version of this.#versions ) {

                // version is the pre-release of the new version
                if ( _version.isPreRelease && _version.release.eq( version.release ) ) {

                    // version is the latest pre-release of the new version
                    if ( !latestPreRelease || _version.gt( latestPreRelease ) ) latestPreRelease = _version;
                }
            }

            this.#lastPreRelease1[ version ] = latestPreRelease || null;
        }

        return this.#lastPreRelease1[ version ];
    }

    getPreviousRelease ( version, { stable } = {} ) {
        if ( !version ) {
            if ( stable ) {
                return this.firstStableRelease;
            }
            else {
                return this.firstRelease;
            }
        }
        else {
            version = GitRelease.new( version );

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

    getNextRelease ( version, { stable } = {} ) {
        if ( !version ) {
            if ( stable ) {
                return this.lastStableRelease;
            }
            else {
                return this.lastRelease;
            }
        }
        else {
            version = GitRelease.new( version );

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
