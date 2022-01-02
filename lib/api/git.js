import "#lib/result";
import childProcess from "child_process";
import Upstream from "#lib/api/git/upstream";

const GIT_MAX_BUFFER_SIZE = 1024 * 1024 * 10; // 10M

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
        if ( this.#root ) args.unshift( "-C", this.#root );

        return new Promise( resolve => {
            childProcess.execFile( "git", args, { "encoding": "utf8", "stdio": ["pipe", "pipe", "pipe"], "maxBuffer": GIT_MAX_BUFFER_SIZE }, ( err, stdout, stderr ) => {
                if ( err ) {
                    resolve( result( [500, err.message] ) );
                }
                else {
                    resolve( result( 200, stdout ) );
                }
            } );
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
}
