const EventEmitter = require( "events" );
const fetch = require( "../http/fetch" );
const { "v4": uuidv4 } = require( "uuid" );
const _proxy = require( "../proxy" );

const BASE_URL = "https://client.hola.org/client_cgi";
const EXT_VER = "1.176.815";
const UPDATE_TIMEOUT = 1000 * 60 * 10; // 10 minutes

class Hola extends EventEmitter {
    #client_id = uuidv4().replaceAll( "-", "" );
    #key;
    #lastUpdated;
    #proxies = [];

    constructor () {
        super();

        setTimeout( this.#update.bind( this ), UPDATE_TIMEOUT );

        this.#update();
    }

    get lastUpdated () {
        return this.#lastUpdated;
    }

    get proxies () {
        return this.#proxies;
    }

    async #update () {
        console.log( `Updating hola proxies list` );

        try {
            var res = await fetch( BASE_URL + "/background_init?uuid=" + this.#client_id, {
                "method": "post",
                "headers": {
                    "User-Agent": "Mozilla/5.0 (X11; Fedora; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36",
                },
                "body": new URLSearchParams( {
                    "login": "1",
                    "ver": EXT_VER,
                } ),
            } );

            if ( !res.ok ) return this.#onError();

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
                    "User-Agent": "Mozilla/5.0 (X11; Fedora; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36",
                },
            } );

            if ( !res.ok ) return this.#onError();

            data = await res.json();

            this.#proxies = [];

            for ( const host of data.ip_list ) {
                const proxy = _proxy( "http://" + "user-uuid-" + this.#client_id + ":" + data.agent_key + "@" + host + ":" + 22222 );

                this.proxies.push( proxy );
            }

            this.#onUpdated();
        }
        catch ( e ) {
            this.#onError();
        }
    }

    #onError () {
        console.log( `Hola proxies update error` );

        this.emit( "error" );
    }

    #onUpdated () {
        console.log( `Hola proxies update done` );

        this.#lastUpdated = new Date();

        this.emit( "updated", this.#proxies );
    }
}

module.exports = new Hola();
