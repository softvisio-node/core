import "#index";

import fetch from "#lib/fetch";
import { sleep } from "#lib/utils";

/** class: CaptchaApi
 * summary: 2captcha API.
 * description: |-
 *   ```
 *   import Captcha from "@softvisio/core/api/2captcha";
 *
 *   const captcha = new Captcha( apiKey, {
 *       "host": apiHost,
 *       "proxy": proxyAddr,
 *   } );
 *
 *   const res = await captcha.resolveNormalCaptcha( imageBuffer );
 *   ```
 */
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

    /** property: proxy
     * summary: Set proxy server.
     */
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

    /** method: resolveNormalCaptcha
     * summary: Resolve normal captcha.
     * description: "(Original API documentation)[https://2captcha.com/2captcha-api#solving_normal_captcha]."
     */
    async resolveNormalCaptcha ( image, options = {} ) {
        const params = {
            ...options,
            "method": "base64",
            "body": image.toString( "base64" ),
        };

        return this._thread( params );
    }

    /** method: resolveReCaptchaV2
     * summary: Resolve google recaptcha v2.
     * description: "(Original API documentation)[https://2captcha.com/2captcha-api#solving_recaptchav2_new]."
     * params:
     *   - name: siteKey
     *     required: true
     *     schema:
     *       type: string
     *   - name: pageURL
     *     required: true
     *     schema:
     *       type: string
     */
    async resolveReCaptchaV2 ( siteKey, pageURL ) {
        const params = {
            "method": "userrecaptcha",
            "googlekey": siteKey,
            "pageurl": pageURL,
        };

        return this._thread( params );
    }

    /** method: resolveInvisibleReCaptchaV2
     * summary: Resolve invisible google recaptcha v2.
     * description: "(Original API documentation)[https://2captcha.com/2captcha-api#invisible]."
     * params:
     *   - name: siteKey
     *     required: true
     *     schema:
     *       type: string
     *   - name: pageURL
     *     required: true
     *     schema:
     *       type: string
     *   - name: options
     *     schema:
     *       type: object
     *       properties:
     *         datas:
     *           type: string
     *         userAgent:
     *           type: string
     *         cookies:
     *           type: object
     *       additionalProperties: false
     */
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

            if ( !res.ok ) return result( [res.status, res.reason] );

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

            if ( !res.ok ) return result( [res.status, res.reason] );

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
