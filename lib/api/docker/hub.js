import fetch from "#lib/fetch";

// NOTE https://docs.docker.com/docker-hub/api/latest/

const API_VERSION = "v2";

export default class DockerHub {
    #username;
    #password;
    #token;

    constructor ( username, password ) {
        this.#username = username;
        this.#password = password;
    }

    // public
    // NOTE for pro or team plans only
    async getImages ( repo, params ) {
        const [namespace, repository] = repo.split( "/" );

        return this.#request( `namespaces/${namespace}/repositories/${repository}/images`, params );
    }

    // NOTE for pro or team plans only
    async deleteImage ( repo, params ) {}

    // NOTE for pro or team plans only
    async getTags ( repo, digest, params ) {
        const [namespace, repository] = repo.split( "/" );

        return this.#request( `namespaces/${namespace}/repositories/${repository}/images/${digest}/tags`, params );
    }

    // private
    async #request ( path, params ) {
        if ( !this.#token ) {
            const token = await this.#login();

            if ( !token.ok ) return token;
        }

        const url = new URL( "https://hub.docker.com/" + API_VERSION + "/" + path );

        const res = await fetch( url, {
            "headers": {
                "authorization": "Bearer " + this.#token,
            },
        } );

        if ( !res.ok ) return result( res );

        const data = await res.json();

        return result( 200, data );
    }

    async #login () {
        const res = await fetch( "https://hub.docker.com/" + API_VERSION + "/users/login", {
            "method": "post",
            "headers": { "content-type": "application/json" },
            "body": JSON.stringify( { "username": this.#username, "password": this.#password } ),
        } );

        if ( !res.ok ) return result( res );

        const data = await res.json();

        this.#token = data.token;

        return result( 200, this.#token );
    }
}
