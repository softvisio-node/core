import "#lib/result";
import childProcess from "node:child_process";
import Releases from "#lib/api/git/releases";
import Upstream from "#lib/api/git/upstream";
import env from "#lib/env";
import Semver from "#lib/semver";
import Counter from "#lib/threads/counter";

const BRANCH_RE = /^(?<current>\*)? +(?:\((?<head>HEAD)[^)]+\)|(?<branch>[^ ]+)) +(?<hash>[\da-z]+)(?: \[ahead (?<ahead>\d+)(?:, behind (?<behind>\d+))?])? (?<description>.+)/;

export default class Git {
    #root;
    #upstream;

    constructor ( root ) {
        this.#root = root;
    }

    // static
    static get Upstream () {
        return Upstream;
    }

    static new ( root ) {
        root = env.findGitRoot( root );

        if ( !root ) throw new Error( `Git root not found` );

        return new this( root );
    }

    // properties
    get root () {
        return this.#root;
    }

    get upstream () {
        if ( !this.#upstream ) {
            const res = this.runSync( "ls-remote", "--get-url" );

            if ( !res.ok || !res.data ) return null;

            this.#upstream = new Upstream( res.data.trim() );
        }

        return this.#upstream;
    }

    // public
    async run ( ...args ) {
        if ( this.#root ) args = [ "-C", this.#root, ...args ];

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
                        resolve( result( [ 500, error.message ] ) );
                    }
                    else {
                        resolve( result( 200, stdout ) );
                    }
                }
            );
        } );
    }

    runSync ( ...args ) {
        if ( this.#root ) args = [ "-C", this.#root, ...args ];

        try {
            const res = childProcess.execFileSync( "git", args, {
                "encoding": "utf8",
                "maxBuffer": Infinity,
                "stdio": [ "pipe", "pipe", "ignore" ],
            } );

            return result( 200, res );
        }
        catch ( e ) {
            return result.catch( e, { "log": false } );
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

        const counter = new Counter();

        // get changeset id
        counter.value++;
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

                [ status.hash, status.abbrev, status.date, ref ] = res.data.split( "\n" );

                ref = ref.split( "," );

                // parse current branch
                const branch = ref.shift().match( /->\s(.+)/ );
                if ( branch ) status.branch = branch[ 1 ];

                // parse tags
                for ( const token of ref ) {
                    const tag = token.match( /tag:\s(.+)/ );
                    if ( tag ) status.tags.push( tag[ 1 ] );
                }
            }

            counter.value--;
        } );

        // get release and release distance
        counter.value++;
        this.run( "describe", "--tags", "--always", "--match", "v[[:digit:]]*" ).then( res => {
            if ( !res.ok ) {
                if ( res.statusText.indexOf( "Not a valid object name HEAD" ) === -1 ) {
                    hasError = true;
                }

                counter.value--;
            }
            else {

                // remove trailing "\n"
                res.data = res.data.trim();

                const match = res.data.match( /^(.*?)-(\d+)-(g[\da-f]+)$/ );

                if ( match && Semver.isValid( match[ 1 ] ) ) {
                    status.currentVersion = new Semver( match[ 1 ] );

                    status.currentVersionDistance = +match[ 2 ];

                    counter.value--;
                }
                else if ( Semver.isValid( res.data ) ) {
                    status.currentVersion = new Semver( res.data );

                    status.currentVersionDistance = 0;

                    counter.value--;
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

                        counter.value--;
                    } );
                }
            }
        } );

        // get dirty status
        counter.value++;
        this.getIsDirty().then( res => {
            if ( !res.ok ) {
                hasError = true;
            }
            else {
                status.isDirty = res.data.isDirty;
            }

            counter.value--;
        } );

        // get push status
        if ( pushStatus ) {
            counter.value++;
            this.run( "branch", "-v", "--no-color" ).then( res => {
                if ( !res.ok ) {
                    hasError = true;
                }
                else {
                    for ( const line of res.data.split( /\n/ ) ) {
                        if ( !line ) continue;

                        const match = line.match( BRANCH_RE );

                        if ( match ) {
                            status.pushStatus[ match.groups.branch || match.groups.head ] = {
                                "ahead": +( match.groups.ahead || 0 ),
                                "behind": +( match.groups.behind || 0 ),
                            };
                        }
                        else {
                            throw Error`Unable to parse git output: ${ line }`;
                        }
                    }
                }

                counter.value--;
            } );
        }
        else {
            delete status.pushStatus;
        }

        // get releases
        if ( releases ) {
            counter.value++;
            this.run( "tag" ).then( res => {
                if ( !res.ok ) {
                    hasError = true;
                }
                else {
                    status.releases = new Releases( res.data.split( /\n/ ) );
                }

                counter.value--;
            } );
        }
        else {
            delete status.releases;
        }

        await counter.wait();

        if ( hasError ) {
            return result( 500 );
        }
        else {
            return result( 200, status );
        }
    }

    async getId () {
        return this.getStatus( {
            "pushStatus": false,
            "releases": false,
        } );
    }

    async getIsDirty () {
        const res = await this.run( "status", "--porcelain" );

        if ( !res.ok ) {
            return res;
        }
        else {
            return result( 200, {
                "isDirty": !!res.data,
            } );
        }
    }
}
