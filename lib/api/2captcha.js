import fetch from "#lib/fetch";
import { sleep } from "#lib/utils";

export default class CaptchaApi {
    #apiUrl;
    #apiKey;
    #_agent;

    constructor ( url, options = {} ) {
        url = new URL( url );

        this.apiKey = url.username;

        url.username = "";
        this.#apiUrl = url.toString();

        this.proxy = options.proxy;
    }

    get proxy () {
        return this.#agent.proxy;
    }

    set proxy ( proxy ) {
        this.#agent.proxy = proxy;
    }

    get #agent () {
        if ( !this.#_agent ) this.#_agent = new fetch.Agent();

        return this.#_agent;
    }

    async resolveNormalCaptcha ( image, options = {} ) {
        const params = {
            ...options,
            "method": "base64",
            "body": image.toString( "base64" ),
        };

        return this._thread( params );
    }

    async resolveReCaptchaV2 ( siteKey, pageURL ) {
        const params = {
            "method": "userrecaptcha",
            "googlekey": siteKey,
            "pageurl": pageURL,
        };

        return this._thread( params );
    }

    async resolveInvisibleReCaptchaV2 ( siteKey, pageURL, options = {} ) {
        const params = {
            "method": "userrecaptcha",
            "googlekey": siteKey,
            "pageurl": pageURL,
            "invisible": 1,
            "data-s": options.datas,
            "userAgent": options.userAgent,
            "cookies": options.cookies,
        };

        return this._thread( params );
    }

    async _thread ( params ) {
        let body = new URLSearchParams( params );

        body.set( "key", this.#apiKey );
        body.set( "json", 1 );

        body = body.toString();

        let id;

        // submit
        while ( 1 ) {
            const res = await fetch( this.#apiUrl + "in.php", {
                "method": "POST",
                "agent": this.#agent,
                "headers": { "Content-Type": "application/x-www-form-urlencoded" },
                body,
            } );

            if ( !res.ok ) return result( res );

            const data = await res.json();

            // ok
            if ( data.status ) {
                id = data.request;

                break;
            }

            // no slots avail., repeat
            else if ( data.request === "ERROR_NO_SLOT_AVAILABLE" ) {
                sleep( 2000 );
            }

            // error
            else {
                return result( [400, data.request] );
            }
        }

        const url = `${this.#apiUrl}res.php?key=${this.#apiKey}&json=1&action=get&id=${id}`;

        // get result
        while ( 1 ) {
            const res = await fetch( url, {
                "agent": this.#agent,
            } );

            if ( !res.ok ) return result( res );

            const data = await res.json();

            // solved
            if ( data.status ) {
                return result( 200, data.request );
            }

            // not solved
            else if ( data.request === "CAPCHA_NOT_READY" ) {
                await sleep( 3000 );
            }

            // error
            else {
                return result( [400, data.request] );
            }
        }
    }
}
