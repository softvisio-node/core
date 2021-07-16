import "#lib/result";
import mixins from "#lib/mixins";
import fetch from "#lib/fetch";

import Pages from "./github/pages.js";
import Releases from "./github/releases.js";

const DEFAULT_URL = "https://api.github.com";

export default class GitHubAPI extends mixins( Pages, Releases ) {
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
                    "Authorization": `token ${this.#token}`,
                },
                "body": options.body,
            } );

            const data = _res.status !== 204 ? await _res.json() : null;

            if ( !_res.ok ) {
                res = result( [_res.status, data?.message || _res.resaon] );
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
