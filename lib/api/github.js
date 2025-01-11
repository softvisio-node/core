import Pages from "#lib/api/github/pages";
import Releases from "#lib/api/github/releases";
import fetch from "#lib/fetch";
import mixins from "#lib/mixins";
import { sleep } from "#lib/utils";

const API_VERSSION = "2022-11-28",
    DEFAULT_URL = "https://api.github.com";

export default class GitHubApi extends mixins( Pages, Releases ) {
    #token;

    constructor ( token ) {
        super();

        this.#token = token;
    }

    // protected
    async _doRequest ( method, url, { search, headers, body, download, rateLimit } = {} ) {
        url = new URL( url, DEFAULT_URL );

        if ( search ) url.search = new URLSearchParams( search );

        var res;

        while ( true ) {
            const _res = await fetch( url, {
                method,
                "headers": {
                    ...headers,
                    "Authorization": `token ${ this.#token }`,
                    "X-GitHub-Api-Version": API_VERSSION,
                },
                "body": body,
            } );

            const meta = {
                "rateLimit": {
                    "retryAfter": _res.headers.get( "retry-after" ),
                    "limit": _res.headers.get( "x-ratelimit-limit" ),
                    "remaining": _res.headers.get( "x-ratelimit-remaining" ),
                    "used": _res.headers.get( "x-ratelimit-used" ),
                    "reset": _res.headers.get( "x-ratelimit-reset" ),
                    "resource": _res.headers.get( "x-ratelimit-resource" ),
                },
            };

            if ( meta.rateLimit.retryAfter ) meta.rateLimit.retryAfter = +meta.rateLimit.retryAfter * 1000;
            if ( meta.rateLimit.limit ) meta.rateLimit.limit = +meta.rateLimit.limit;
            if ( meta.rateLimit.remaining ) meta.rateLimit.remaining = +meta.rateLimit.remaining;
            if ( meta.rateLimit.used ) meta.rateLimit.used = +meta.rateLimit.used;
            if ( meta.rateLimit.reset ) meta.rateLimit.reset = new Date( +meta.rateLimit.reset );

            if ( download ) {
                if ( _res.ok ) {
                    return _res;
                }
                else {
                    res = result( _res );
                }
            }
            else {
                try {
                    const data = _res.status !== 204
                        ? await _res.json()
                        : null;

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
            }

            res.meta = meta;

            // rate limit
            if ( !res.ok && rateLimit && ( res.status === 403 || res.status === 429 ) ) {
                if ( res.meta.rateLimit.retryAfter != null ) {
                    await sleep( res.meta.rateLimit.retryAfter );

                    continue;
                }
                else if ( res.meta.rateLimit.remaining != null ) {
                    await sleep( res.meta.rateLimit.reset );

                    continue;
                }
            }

            break;
        }

        return res;
    }
}
