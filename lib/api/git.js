import "#lib/result";
import childProcess from "child_process";
import Upstream from "#lib/api/git/upstream";
import Releases from "#lib/api/git/releases";
import Semver from "#lib/semver";
import Semaphore from "#lib/threads/semaphore1";

const BRANCH_RE = /^(?<current>\*)? +(?:\((?<head>HEAD)[^)]+\)|(?<branch>[^ ]+)) +(?<hash>[a-z0-9]+)(?: \[ahead (?<ahead>\d+)\])? (?<description>.+)/;

export default class Git {
    #root;

    constructor ( root ) {
        this.#root = root;
    }

    // static
    static get Upstream () {
        return Upstream;
    }

    // properties
    get root () {
        return this.#root;
    }

    // public
    async run ( ...args ) {
        if ( this.#root ) args = ["-C", this.#root, ...args];

        return new Promise( resolve => {
            childProcess.execFile(
                "git",
                args,
                {
                    "encoding": "utf8",
                    "maxBuffer": Infinity,
                },
                ( error, stdout, stderr ) => {
                    if ( error ) {
                        resolve( result( [500, error.message] ) );
                    }
                    else {
                        resolve( result( 200, stdout ) );
                    }
                }
            );
        } );
    }

    async getUpstream ( url ) {
        if ( url ) {
            return new Upstream( url );
        }
        else {
            const res = await this.run( "ls-remote", "--get-url" );

            if ( !res.ok || !res.data ) return;

            return new Upstream( res.data.trim() );
        }
    }

    async getStatus ( { pushStatus = true, releases = true } = {} ) {
        const status = {

            // commit
            "hash": null,
            "abbrev": null,
            "date": null,
            "branch": null,
            "tags": [],
            "currentVersion": new Semver(),
            "currentVersionDistance": null,

            // state
            "isDirty": null,
            "pushStatus": {},
            "releases": null,
        };

        let hasError;

        const semaphore = new Semaphore().up();

        // get changeset id
        semaphore.up();
        this.run( "log", "-1", "--pretty=format:%H%n%h%n%cI%n%D" ).then( res => {
            if ( !res.ok ) {
                if ( !res.statusText.includes( "does not have any commits yet" ) ) {
                    hasError = true;
                }
            }
            else if ( !res.data ) {
                hasError = true;
            }
            else {
                let ref;

                [status.hash, status.abbrev, status.date, ref] = res.data.split( "\n" );

                ref = ref.split( "," );

                // parse current branch
                const branch = ref.shift().match( /->\s(.+)/ );
                if ( branch ) status.branch = branch[1];

                // parse tags
                for ( const token of ref ) {
                    const tag = token.match( /tag:\s(.+)/ );
                    if ( tag ) status.tags.push( tag[1] );
                }
            }

            semaphore.down();
        } );

        // get release and release distance
        semaphore.up();
        this.run( "describe", "--tags", "--always", "--match", "v[[:digit:]]*" ).then( res => {
            if ( !res.ok ) {
                if ( res.statusText.indexOf( "Not a valid object name HEAD" ) === -1 ) {
                    hasError = true;
                }

                semaphore.down();
            }
            else {

                // remove trailing "\n"
                res.data = res.data.trim();

                const match = res.data.match( /^(.*?)-(\d+)-(g[a-f0-9]+)$/ );

                if ( match && Semver.isValid( match[1] ) ) {
                    status.currentVersion = new Semver( match[1] );

                    status.currentVersionDistance = +match[2];

                    semaphore.down();
                }
                else if ( Semver.isValid( res.data ) ) {
                    status.currentVersion = new Semver( res.data );

                    status.currentVersionDistance = 0;

                    semaphore.down();
                }

                // release distance from the previous version tag wasn't found
                else {

                    // get total number of commits
                    this.run( "rev-list", "HEAD", "--count" ).then( res => {
                        if ( !res.ok ) {
                            hasError = true;
                        }
                        else {
                            status.currentVersionDistance = +res.data.trim();
                        }

                        semaphore.down();
                    } );
                }
            }
        } );

        // get dirty status
        semaphore.up();
        this.run( "status", "--porcelain" ).then( res => {
            if ( !res.ok ) {
                hasError = true;
            }
            else {
                status.isDirty = !!res.data;
            }

            semaphore.down();
        } );

        // get push status
        if ( pushStatus ) {
            semaphore.up();
            this.run( "branch", "-v", "--no-color" ).then( res => {
                if ( !res.ok ) {
                    hasError = true;
                }
                else {
                    for ( const line of res.data.split( /\n/ ) ) {
                        if ( !line ) continue;

                        const match = line.match( BRANCH_RE );

                        if ( match ) {
                            status.pushStatus[match.groups.branch || match.groups.head] = match.groups.ahead ? +match.groups.ahead : 0;
                        }
                        else {
                            throw Error`Unable to parse git output: ${line}`;
                        }
                    }
                }

                semaphore.down();
            } );
        }
        else delete status.pushStatus;

        // get releases
        if ( releases ) {
            semaphore.up();
            this.run( "tag" ).then( res => {
                if ( !res.ok ) {
                    hasError = true;
                }
                else {
                    status.releases = new Releases( res.data.split( /\n/ ) );
                }

                semaphore.down();
            } );
        }
        else delete status.releases;

        await semaphore.down().wait();

        if ( hasError ) {
            return result( 500 );
        }
        else {
            return result( 200, status );
        }
    }

    async getId () {
        return this.getStatus( { "pushStatus": false, "releases": false } );
    }
}
