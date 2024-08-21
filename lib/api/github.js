import mixins from "#lib/mixins";
import fetch from "#lib/fetch";

import Pages from "#lib/api/github/pages";
import Releases from "#lib/api/github/releases";

const API_VERSSION = "2022-11-28";

const DEFAULT_URL = "https://api.github.com";

// NOTE: with keep-alive github hangs-up socket from time to time
const dispatcher = new fetch.Dispatcher( {
    "pipelining": 0,
} );

export default class GitHubApi extends mixins( Pages, Releases ) {
    #token;

    constructor ( token ) {
        super();

        this.#token = token;
    }

    // protected
    async _req ( method, url, options = {} ) {
        url = new URL( url, DEFAULT_URL );

        if ( options.search ) url.search = new URLSearchParams( options.search );

        var res;

        try {
            const _res = await fetch( url, {
                method,
                "headers": {
                    ...( options.headers || {} ),
                    "Authorization": `token ${ this.#token }`,
                    "X-GitHub-Api-Version": API_VERSSION,
                },
                "body": options.body,
                dispatcher,
            } );

            if ( options.download ) return res;

            const data = _res.status !== 204 ? await _res.json() : null;

            if ( !_res.ok ) {
                res = result( [ _res.status, data?.message || _res.statusText ] );
            }
            else {
                res = result( 200, data );
            }
        }
        catch ( e ) {
            res = result.catch( e );
        }

        return res;
    }
}
