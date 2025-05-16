import "#lib/result";
import childProcess from "node:child_process";
import { pipeline, Readable } from "node:stream";
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
            const res = this.execSync( [ "ls-remote", "--get-url" ] );

            if ( !res.ok || !res.data ) return null;

            this.#upstream = new Upstream( res.data.trim() );
        }

        return this.#upstream;
    }

    // public
    async exec ( args, { cwd, encoding, input } = {} ) {
        if ( !Array.isArray( args ) ) args = [ args ];

        if ( this.#root ) cwd ??= this.#root;

        return new Promise( resolve => {
            try {
                const proc = childProcess.spawn( "git", args, {
                    cwd,
                    "encoding": "buffer",
                    "stdio": [ input
                        ? "pipe"
                        : "ignore", "pipe", "pipe" ],
                } );

                const stdout = [],
                    stderr = [];

                proc.once( "error", e => resolve( result( [ 500, e.message ] ) ) );

                proc.stdout.on( "data", data => stdout.push( data ) );

                proc.stderr.on( "data", data => stderr.push( data ) );

                proc.once( "close", code => {
                    var res;

                    if ( code ) {
                        res = result( 500, Buffer.concat( stderr ).toString() );
                    }
                    else {
                        let data = Buffer.concat( stdout );

                        if ( encoding !== "buffer" ) {
                            data = data.toString( encoding || "utf8" );
                        }

                        res = result( 200, data );
                    }

                    resolve( res );
                } );

                if ( input ) {
                    if ( input instanceof Readable ) {
                        pipeline( input, proc.stdin, e => {
                            if ( e ) {
                                resolve( result( [ 500, e.message ] ) );

                                proc.kill( "SIGKILL" );
                            }
                        } );
                    }
                    else {
                        proc.stdin.write( input );
                        proc.stdin.end();
                    }
                }
            }
            catch ( e ) {
                resolve( result( [ 500, e.message ] ) );
            }
        } );
    }

    execSync ( args, { cwd, encoding, input } = {} ) {
        if ( !Array.isArray( args ) ) args = [ args ];

        if ( this.#root ) cwd ??= this.#root;

        try {
            const res = childProcess.spawnSync( "git", args, {
                cwd,
                "encoding": "buffer",
                "maxBuffer": Infinity,
                input,
                "stdio": [ input
                    ? "pipe"
                    : "ignore", "pipe", "pipe" ],
            } );

            if ( res.status ) {
                return result( 500, res.stderr.toString() );
            }
            else if ( res.error ) {
                return result( [ 500, res.error.message ], res.stderr.toString() );
            }
            else {
                return result( 200, encoding === "buffer"
                    ? res.stdout
                    : res.stdout.toString( encoding || "utf8" ) );
            }
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

                // version
                "currentVersion": new Semver(),
                "currentVersionDistance": null,

                // state
                "isDirty": null,
                "pushStatus": {},
                "releases": null,
            },
            counter = new Counter();

        var error;

        // get changeset id
        counter.value++;
        this.getChangeset().then( res => {
            if ( !res.ok ) {
                error = res;
            }
            else {
                status.hash = res.data.tags;
                status.abbrev = res.data.abbrev;
                status.date = res.data.date;
                status.branch = res.data.branch;
                status.tags = res.data.tags;
            }

            counter.value--;
        } );

        // get release and release distance
        counter.value++;
        this.getCurrentRelease().then( res => {
            if ( res.ok ) {
                status.currentVersion = res.data.version;
                status.currentVersionDistance = res.data.distance;
            }
            else {
                error = res;
            }

            counter.value--;
        } );

        // get dirty status
        counter.value++;
        this.getIsDirty().then( res => {
            if ( !res.ok ) {
                error = res;
            }
            else {
                status.isDirty = res.data.isDirty;
            }

            counter.value--;
        } );

        // get push status
        if ( pushStatus ) {
            counter.value++;
            this.getPushStatus().then( res => {
                if ( !res.ok ) {
                    error = res;
                }
                else {
                    status.pushStatus = res.data;
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
            this.getReleases().then( res => {
                if ( res.ok ) {
                    status.releases = res.data;
                }
                else {
                    error = res;
                }

                counter.value--;
            } );
        }
        else {
            delete status.releases;
        }

        await counter.wait();

        if ( error ) {
            return error;
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

    async getChangeset () {
        const data = {
            "hash": null,
            "abbrev": null,
            "date": null,
            "branch": null,
            "tags": [],
        };

        const res = await this.exec( [ "log", "-1", "--pretty=format:%H%n%h%n%cI%n%D" ] );

        if ( !res.ok ) {
            if ( !res.data.includes( "does not have any commits yet" ) ) {
                return res;
            }
        }
        else if ( !res.data ) {
            return result( 500 );
        }
        else {
            let ref;

            [ data.hash, data.abbrev, data.date, ref ] = res.data.split( "\n" );

            ref = ref.split( "," );

            // parse current branch
            const branch = ref.shift().match( /->\s(.+)/ );
            if ( branch ) data.branch = branch[ 1 ];

            // parse tags
            for ( const token of ref ) {
                const tag = token.match( /tag:\s(.+)/ );

                if ( tag ) data.tags.push( tag[ 1 ] );
            }
        }

        return result( 200, data );
    }

    async getIsDirty () {
        const res = await this.exec( [ "status", "--porcelain" ] );

        if ( !res.ok ) {
            return res;
        }
        else {
            return result( 200, {
                "isDirty": !!res.data,
            } );
        }
    }

    async getCurrentRelease ( { release } = {} ) {
        var res,
            data = {
                "version": new Semver(),
                "distance": 0,
            };

        var filter = release
            ? [ "--match=v[0-9]*.[0-9]*.[0-9]*", "--exclude=v*[!0-9.]*" ]
            : [ "--match=v[0-9]*.[0-9]*.[0-9]*" ];

        res = await this.exec( [ "describe", "--tags", "--always", "--candidates=1000", ...filter ] );

        if ( !res.ok ) {

            // repository has no commits
            if ( res.data.includes( "Not a valid object name HEAD" ) ) {
                return result( 200, data );
            }
            else {
                return res;
            }
        }

        // remove trailing "\n"
        const description = res.data.trim();

        const match = description.match( /^(?<version>v\d.+?)-(?<distance>\d+)-(?<commit>g[\da-f]+)$/ );

        // has commits after release
        if ( match && Semver.isValid( match.groups.version ) ) {
            data.version = new Semver( match.groups.version );
            data.distance = +match.groups.distance;
        }

        // release commit
        else if ( description.startsWith( "v" ) && Semver.isValid( description ) ) {
            data.version = new Semver( description );
        }

        // release distance from the previous version tag wasn't found
        else {

            // get total number of commits
            res = await this.exec( [ "rev-list", "HEAD", "--count" ] );

            if ( res.ok ) {
                data.distance = +res.data.trim();
            }
            else {
                return res;
            }
        }

        return result( 200, data );
    }

    async getPushStatus () {
        const data = {},
            res = await this.exec( [ "branch", "-v", "--no-color" ] );

        if ( !res.ok ) return res;

        for ( const line of res.data.split( "\n" ) ) {
            if ( !line ) continue;

            const match = line.match( BRANCH_RE );

            if ( match ) {
                data[ match.groups.branch || match.groups.head ] = {
                    "ahead": +( match.groups.ahead || 0 ),
                    "behind": +( match.groups.behind || 0 ),
                };
            }
            else {
                throw Error`Unable to parse git output: ${ line }`;
            }
        }

        return result( 200, data );
    }

    async getReleases () {
        const res = await this.exec( [ "tag" ] );

        if ( res.ok ) {
            return result( 200, new Releases( res.data.split( /\n/ ) ) );
        }
        else {
            return res;
        }
    }
}
