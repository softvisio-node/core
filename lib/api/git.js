import "#lib/result";
import childProcess from "node:child_process";
import { pipeline, Readable } from "node:stream";
import env from "#lib/env";
import SemanticVersion from "#lib/semantic-version";
import Counter from "#lib/threads/counter";
import uuid from "#lib/uuid";
import GitChanges from "./git/changes.js";
import GitCommit from "./git/commit.js";
import GitReleases from "./git/releases.js";
import GitUpstream from "./git/upstream.js";

const BRANCH_RE = /^(?<current>\*)? +(?:\((?<head>HEAD)[^)]+\)|(?<branch>[^ ]+)) +(?<hash>[\da-z]+)(?: \[ahead (?<ahead>\d+)(?:, behind (?<behind>\d+))?])? (?<description>.+)/,
    SEMANTIC_VERSION_GLOB_PATTERN = "v[0-9]*.[0-9]*.[0-9]*";

export default class Git {
    #root;
    #upstream;

    constructor ( root ) {
        this.#root = root;
    }

    // static
    static get Upstream () {
        return GitUpstream;
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

            this.#upstream = new GitUpstream( res.data.trim() );
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

                // head commit
                "head": null,

                // version
                "currentRelease": null,
                "unreleasedCommits": null,

                // state
                "isDirty": null,
                "pushStatus": null,

                // releases
                "releases": null,
            },
            counter = new Counter();

        var error;

        // get head commit
        counter.value++;
        this.getCommit().then( res => {
            if ( !res.ok ) {
                error = res;
            }
            else {
                status.head = res.data;
            }

            counter.value--;
        } );

        // get release and release distance
        counter.value++;
        this.getCurrentRelease().then( res => {
            if ( res.ok ) {
                status.currentRelease = res.data.currentRelease;
                status.unreleasedCommits = res.data.unreleasedCommits;
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
        const res = await this.getStatus( {
            "pushStatus": false,
            "releases": false,
        } );
        if ( !res.ok ) return res;

        const head = res.data.head;
        delete res.data.head;

        res.data.hash = head.hash;
        res.data.abbrev = head.abbrev;
        res.data.date = head.date;
        res.data.branch = head.branch;
        res.data.tags = [ ...head.tags ];

        return res;
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

    async getCurrentRelease ( { commit, stable, changes } = {} ) {
        commit ||= "HEAD";

        var res;

        // identify commit
        res = await this.getCommit( commit );
        if ( !res.ok ) return res;
        commit = res.data;
        if ( !commit ) return result( [ 400, "Commit not found" ] );

        // get releases
        res = await this.getReleases();
        if ( !res.ok ) return res;
        const releases = res.data;

        const data = {
            "currentRelease": null,
            "unreleasedCommits": 0,
            "changes": null,
        };

        // commit is not a branch HEAD
        if ( !commit.isBranchHead ) {
            return result( [ 400, "Commit should be a branch head or semantic version tag name" ] );
        }

        // commit is release
        if ( commit.isRelease ) {
            if ( stable ) {
                if ( commit.releaseVersion.isStableRelease ) {
                    data.currentRelease = releases.get( commit.releaseVersion );
                }
            }
            else {
                data.currentRelease = releases.get( commit.releaseVersion );
            }
        }

        // find current release, respect stable
        if ( !data.currentRelease ) {
            res = await this.#findPreviousRelease( commit.hash, { stable } );
            if ( !res.ok ) return res;

            // current release found
            if ( res.data ) data.currentRelease = releases.get( res.data );

            // find distance
            res = await this.getCommitsDistance( [ data.currentRelease?.version ] );
            if ( !res.ok ) return res;

            data.unreleasedCommits = res.data;
        }

        if ( changes ) {
            res = await this.getChanges( [ data.currentRelease?.version, commit.hash ] );
            if ( !res.ok ) return res;

            data.changes = res.data;
        }

        return result( 200, data );
    }

    // XXX
    async getRelease ( { commit, stable, changes } = {} ) {
        commit ||= "HEAD";

        var res;

        // identify commit
        res = await this.getCommit( commit );
        if ( !res.ok ) return res;
        commit = res.data;
        if ( !commit ) return result( [ 400, "Commit not found" ] );

        // get releases
        res = await this.getReleases();
        if ( !res.ok ) return res;
        const releases = res.data;

        const data = {
            "currentRelease": null,
            "previousRelease": null,
            "unreleasedCommits": 0,
            "lastCommit": commit,
        };

        // commit is release
        if ( commit.isRelease ) {
            data.currentRelease = releases.get( commit.releaseVersion );
        }

        // commit is not a branch HEAD
        else if ( !commit.isBranchHead ) {
            return result( [ 400, "Commit should be a branch head or semantic version tag name" ] );
        }

        // find previous release, respect stable
        res = await this.#findPreviousRelease( commit.hash + "~1", { stable } );
        if ( !res.ok ) return res;

        // previous release found
        if ( res.data ) data.previousRelease = releases.get( res.data );

        // get unreleased commits
        if ( !data.currentRelease ) {
            res = await this.getCommitsDistance( [ data.previousRelease ] );
            if ( !res.ok ) return res;

            data.unreleasedCommits = res.data;
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
        const res = await this.exec( [ "tag", "--list", SEMANTIC_VERSION_GLOB_PATTERN, "--format", "%(refname:strip=2)%00%(creatordate:iso)" ] );

        if ( res.ok ) {
            const tags = res.data
                .split( "\n" )
                .filter( line => line )
                .map( line => {
                    const [ version, date ] = line.split( "\0" );

                    return {
                        version,
                        date,
                    };
                } );

            return result( 200, new GitReleases( tags ) );
        }
        else {
            return res;
        }
    }

    async getCommit ( commit ) {
        const res = await this.getCommits( commit || "HEAD", { "maxCount": 1 } );

        if ( !res.ok ) return res;

        res.data = res.data?.[ 0 ];

        return res;
    }

    async getCommits ( commitsRange, { maxCount } = {} ) {
        commitsRange = this.#createCommitsRange( commitsRange );

        // prepare git command
        const rowsSeparator = uuid(),
            separator = uuid(),
            decorateSeparator = uuid(),
            tagId = uuid(),
            args = [ "log", `--pretty=format:%H${ separator }%h${ separator }%cI${ separator }%cN${ separator }%(decorate:prefix=,suffix=,pointer=->,tag=${ tagId },separator=${ decorateSeparator })${ separator }%P${ separator }%B${ rowsSeparator }` ];

        if ( maxCount ) args.push( "--max-count", maxCount );

        args.push( commitsRange );

        const res = await this.exec( args );

        if ( !res.ok ) {

            // no commits found
            if ( res.data.includes( "does not have any commits yet" ) || res.data.includes( "unknown revision or path not in the working tree" ) ) {
                return result( 200 );
            }
            else {
                return res;
            }
        }

        const commits = [];

        if ( res.data ) {
            for ( const commit of res.data.split( rowsSeparator ) ) {
                const [ hash, abbrev, date, author, refsSegment, parentHashes, message ] = commit.trim().split( separator );

                if ( !hash ) continue;

                const data = {
                    "message": message.trim(),
                    hash,
                    abbrev,
                    date,
                    author,
                    "isHead": false,
                    "branch": null,
                    "branches": new Set(),
                    "tags": new Set(),
                    "parentHashes": new Set( parentHashes.split( " " ) ),
                };

                // parse refs
                const refs = refsSegment.split( decorateSeparator );

                for ( let n = 0; n < refs.length; n++ ) {
                    const ref = refs[ n ].trim();

                    if ( !ref ) continue;

                    // first ref
                    if ( n === 0 ) {

                        // HEAD
                        if ( ref === "HEAD" ) {
                            data.isHead = true;

                            continue;
                        }

                        // HEAD->branch
                        else if ( ref.startsWith( "HEAD->" ) ) {
                            data.isHead = true;
                            data.branch = ref.slice( 6 );

                            data.branches.add( data.branch );

                            continue;
                        }
                    }

                    // tag
                    if ( ref.startsWith( tagId ) ) {
                        data.tags.add( ref.slice( tagId.length ) );
                    }

                    // branch
                    else {
                        data.branches.add( ref );
                    }
                }

                commits.push( new GitCommit( data ) );
            }
        }

        return result( 200, commits.length
            ? commits
            : null );
    }

    async getCommitsDistance ( commitsRange ) {
        commitsRange = this.#createCommitsRange( commitsRange );

        const res = await this.exec( [ "rev-list", "--count", commitsRange ] );
        if ( !res.ok ) return res;

        return result( 200, Number( res.data.trim() ) );
    }

    async getChanges ( commitsRange ) {
        const res = await this.getCommits( commitsRange );
        if ( !res.ok ) return res;

        return result( 200, new GitChanges( res.data ) );
    }

    // private
    #createCommitsRange ( commitsRange ) {
        var firstCommit, lastCommit;

        if ( Array.isArray( commitsRange ) ) {
            [ firstCommit, lastCommit ] = commitsRange;
        }
        else {
            lastCommit = commitsRange;
        }

        // prepare start commit
        if ( SemanticVersion.isValid( firstCommit ) ) {
            firstCommit = SemanticVersion.new( firstCommit ).versionString;
        }

        // prepare end commit
        if ( SemanticVersion.isValid( lastCommit ) ) {
            lastCommit = SemanticVersion.new( lastCommit ).versionString;
        }

        // prepare commits range
        if ( firstCommit && lastCommit ) {
            commitsRange = `${ firstCommit }..${ lastCommit }`;
        }
        else if ( firstCommit && !lastCommit ) {
            commitsRange = `${ firstCommit }..HEAD`;
        }
        else if ( !firstCommit && lastCommit ) {
            commitsRange = lastCommit;
        }
        else {
            commitsRange = "HEAD";
        }

        return commitsRange;
    }

    async #findPreviousRelease ( commit, { stable } ) {
        const args = [ "describe", "--tags", "--always", "--abbrev=0", "--candidates=1000" ];

        if ( stable ) {
            args.push( "--match", SEMANTIC_VERSION_GLOB_PATTERN, "--exclude", "v*[!0-9.]*" );
        }
        else {
            args.push( "--match", SEMANTIC_VERSION_GLOB_PATTERN );
        }

        args.push( commit );

        const res = await this.exec( args );

        if ( !res.ok ) {

            // repository has no commits
            if ( res.data.startsWith( "fatal: Not a valid object name" ) ) {
                return result( 200 );
            }
            else {
                return res;
            }
        }

        const match = res.data.trim().match( /^(?<version>v\d+\.\d+\.\d+.*)$/ );

        // has commits after release
        if ( match && SemanticVersion.isValid( match.groups.version ) ) {
            return result( 200, new SemanticVersion( match.groups.version ) );
        }

        // release not found
        else {
            return result( 200 );
        }
    }
}
