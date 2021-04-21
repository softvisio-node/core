require( "#index" );

const fetch = require( "@softvisio/core/http/fetch" );
const fs = require( "fs" );
const FormData = require( "form-data" );

module.exports = class Bitbucket {
    #username;
    #password;

    #_auth;

    constructor ( options = {} ) {
        this.#username = options.username;
        this.#password = options.password;
    }

    get #auth () {
        if ( !this.#_auth ) this.#_auth = "Basic " + Buffer.from( this.#username + ":" + this.#password ).toString( "base64" );

        return this.#_auth;
    }

    async #req ( method, endpoint, data ) {
        const res = await fetch( "https://api.bitbucket.org/2.0" + endpoint, {
            method,
            "headers": {
                "Authorization": this.#auth,
                "Content-Type": "application/json",
            },
        } );

        const json = await res.json();

        return result( 200, json );
    }

    // https://developer.atlassian.com/bitbucket/api/2/reference/resource/repositories/{workspace}/{repo_slug}/downloads#get
    async downloads ( repo ) {
        const res = await this.#req( "get", `/repositories/${repo}/downloads` );

        return res;
    }

    // https://developer.atlassian.com/bitbucket/api/2/reference/resource/repositories/{workspace}/{repo_slug}/downloads#post
    async upload ( repo, name, path ) {
        const form = new FormData();

        form.append( "files", fs.createReadStream( path ), {
            "filename": name,
        } );

        const res = await fetch( `https://api.bitbucket.org/2.0/repositories/${repo}/downloads`, {
            "method": "post",
            "headers": {
                ...form.getHeaders(),
                "Authorization": this.#auth,
            },
            "body": form,
        } );

        return result( [res.status, res.reson] );
    }
};
