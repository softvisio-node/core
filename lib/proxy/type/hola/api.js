const fetch = require( "../../../http/fetch" );
const { "v4": uuidv4 } = require( "uuid" );

const BASE_URL = "https://client.hola.org/client_cgi";
const EXT_VER = "1.176.815";
const USER_AGENT = "Mozilla/5.0 (X11; Fedora; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36";

module.exports = class Hola {
    #client_id = uuidv4().replaceAll( "-", "" );
    #key;
    #lastUpdated;
    #isUpdating;
    #updateRequests = [];

    get lastUpdated () {
        return this.#lastUpdated;
    }

    async getProxies () {
        if ( this.#isUpdating ) return new Promise( resolve => this.#updateRequests.push( resolve ) );

        this.#isUpdating = true;

        console.log( `Updating hola proxies list` );

        var proxies;

        try {
            var res = await fetch( BASE_URL + "/background_init?uuid=" + this.#client_id, {
                "method": "post",
                "headers": {
                    "User-Agent": USER_AGENT,
                },
                "body": new URLSearchParams( {
                    "login": "1",
                    "ver": EXT_VER,
                } ),
            } );

            if ( !res.ok ) throw Error();

            var data = await res.json();

            this.#key = data.key;

            const url =
                BASE_URL +
                "/zgettunnels?" +
                new URLSearchParams( {
                    "country": "US", // if country is not set it returns small list of proxies
                    "limit": 9999999,
                    "ping_id": Math.random(),
                    "ext_ver": EXT_VER,
                    "browser": "chrome",
                    "product": "cws",
                    "uuid": this.#client_id,
                    "session_key": this.#key,
                    "is_premium": 1,
                } );

            res = await fetch( url, {
                "headers": {
                    "User-Agent": USER_AGENT,
                },
            } );

            if ( !res.ok ) throw Error();

            data = await res.json();

            proxies = [];

            for ( const host of Object.values( data.ip_list ) ) {
                const proxy = "hola-static://" + "user-uuid-" + this.#client_id + ":" + data.agent_key + "@" + host + ":" + 22222;

                proxies.push( proxy );
            }

            console.log( `Hola proxies list updated` );
        }
        catch ( e ) {
            console.log( `Hola proxies update error` );
        }

        this.#isUpdating = false;

        this.#lastUpdated = new Date();

        const updateRequests = this.#updateRequests;
        this.#updateRequests = [];

        for ( const cb of updateRequests ) {
            cb( proxies );
        }

        return proxies;
    }
};
