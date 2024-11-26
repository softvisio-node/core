import Pages from "#lib/api/github/pages";
import Releases from "#lib/api/github/releases";
import fetch from "#lib/fetch";
import mixins from "#lib/mixins";
import { sleep } from "#lib/utils";

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
    async _req ( method, url, { search, headers, body, download, rateLimit } = {} ) {
        url = new URL( url, DEFAULT_URL );

        if ( search ) url.search = new URLSearchParams( search );

        var res;

        while ( true ) {
            try {
                const _res = await fetch( url, {
                    method,
                    "headers": {
                        ...headers,
                        "Authorization": `token ${ this.#token }`,
                        "X-GitHub-Api-Version": API_VERSSION,
                    },
                    "body": body,
                    dispatcher,
                } );

                if ( download ) return res;

                const data = _res.status !== 204
                    ? await _res.json()
                    : null;

                if ( !_res.ok ) {
                    res = result( [ _res.status, data?.message || _res.statusText ] );
                }
                else {
                    res = result( 200, data );
                }

                res.meta = {
                    "rateLimit": {
                        "limit": _res.headers.get( "x-ratelimit-limit" ),
                        "remaining": _res.headers.get( "x-ratelimit-remaining" ),
                        "used": _res.headers.get( "x-ratelimit-used" ),
                        "reset": _res.headers.get( "x-ratelimit-reset" ),
                        "resource": _res.headers.get( "x-ratelimit-resource" ),
                    },
                };
            }
            catch ( e ) {
                res = result.catch( e );
            }

            if ( !res.ok && rateLimit && res.meta.rateLimit ) {
                if ( +res.meta.rateLimit.remaining === 0 ) {
                    await sleep( new Date( +res.meta.rateLimit.reset ) );

                    continue;
                }
            }

            break;
        }

        return res;
    }
}
