const fetch = require( "../http/fetch" );
const Agent = require( "../http/agent" );
const result = require( "../result" );
const _proxy = require( "../proxy" );
const { sleep } = require( "@softvisio/core/util" );

/** class: CaptchaApi
 * summary: 2captcha API.
 * description: |-
 *   ```
 *   const Captcha = require( "@softvisio/core/api/2captcha" );
 *
 *   const captcha = new Captcha( apiKey, {
 *       "host": apiHost,
 *       "proxy": proxyAddr,
 *   } );
 *
 *   const res = await captcha.resolveNormalCaptcha( imageBuffer );
 *   ```
 */
module.exports = class CaptchaApi {
    #apiKey;
    #host;
    #proxy;
    #agent;

    constructor ( apiKey, options = {} ) {
        this.#apiKey = apiKey;

        this.#host = options.host;

        this.proxy = options.proxy;
    }

    /** property: proxy
     * summary: Set proxy server.
     */
    get proxy () {
        return this.#proxy;
    }

    set proxy ( proxy ) {
        if ( !proxy ) {
            this.#proxy = null;
        }
        else {
            this.#proxy = _proxy( proxy );
        }
    }

    get _agent () {
        if ( !this.#agent ) {
            this.#agent = new Agent( {
                "proxy": this.#proxy,
            } );
        }

        return this.#agent;
    }

    /** method: resolveNormalCaptcha
     * summary: Resolve normal captcha.
     * description: '(Original API documentation)[https://2captcha.com/2captcha-api#solving_normal_captcha].'
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
     * description: '(Original API documentation)[https://2captcha.com/2captcha-api#solving_recaptchav2_new].'
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
     * description: '(Original API documentation)[https://2captcha.com/2captcha-api#invisible].'
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
     *       schema:
     *         type: object
     *         properties:
     *           datas: {type: string}
     *           userAgent: {type: string}
     *           cookies: {type: object}
     *         additionalProperties: false
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
            const res = await fetch( "http://" + this.#host + "/in.php", {
                "method": "POST",
                "agent": this._agent.nodeFetchAgent,
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

        const url = `http://${this.#host}/res.php?key=${this.#apiKey}&json=1&action=get&id=${id}`;

        // get result
        while ( 1 ) {
            const res = await fetch( url, {
                "agent": this._agent.nodeFetchAgent,
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
};
