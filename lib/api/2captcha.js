const fetch = require( "../http/fetch" );
const Agent = require( "../http/agent" );
const result = require( "../result" );
const _proxy = require( "../proxy" );
const { sleep } = require( "@softvisio/core/util" );

module.exports = class {
    #apiKey;
    #host;
    #proxy;
    #agent;

    constructor ( apiKey, options = {} ) {
        this.#apiKey = apiKey;

        this.#host = options.host;

        this.proxy = options.proxy;
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

    // https://2captcha.com/2captcha-api#solving_normal_captcha
    async resolveNormalCaptcha ( image, options = {} ) {
        const params = {
            ...options,
            "method": "base64",
            "body": image.toString( "base64" ),
        };

        return this._thread( params );
    }

    // https://2captcha.com/2captcha-api#solving_recaptchav2_new
    async resolveReCaptchav2 ( googlekey, pageurl ) {
        const params = {
            "method": "userrecaptcha",
            googlekey,
            pageurl,
        };

        return this._thread( params );
    }

    // https://2captcha.com/2captcha-api#invisible
    async resolveInvisibleReCaptchav2 ( googlekey, pageurl, datas, cookies, userAgent ) {
        const params = {
            "method": "userrecaptcha",
            googlekey,
            pageurl,
            "invisible": 1,
            "data-s": datas,
            cookies,
            userAgent,
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
