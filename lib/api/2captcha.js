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

    async _thread ( params ) {
        let body = new URLSearchParams( params );

        body.set( "key", this.#apiKey );
        body.set( "json", 1 );

        body = body.toString();

        while ( 1 ) {
            const res = await fetch( "http://" + this.#host + "/in.php", {
                "method": "POST",
                "agent": this._agent.nodeFetchAgent,
                "headers": { "Content-Type": "application/x-www-form-urlencoded" },
                body,
            } );

            console.log( res.status, res.reason );

            // console.log( await res.json() );

            sleep( 1 );

            break;
        }

        return result( 200 );
    }
};
