import fetch from "#lib/fetch";
import uuid from "#lib/uuid";
import Mutex from "#lib/threads/mutex";
import CacheLru from "#lib/cache/lru";

const DEFAULT_UPDATE_INTERVAL = 1000 * 60 * 10; // 10 minutes
const BASE_URL = "https://client.hola.org/client_cgi";
const EXT_VER = "1.176.815";

const MUTEX_SET = new Mutex.Set();
const CACHE = new CacheLru();

class Hola {
    clientId = uuid().replaceAll( "-", "" );
    #key;

    async getProxies ( country ) {
        if ( !country ) country = "";
        else country = country.toLowerCase();

        var proxies = CACHE.get( country );

        if ( proxies ) return proxies;

        proxies = [];

        const mutex = MUTEX_SET.get( country || "all-countries" );

        if ( !mutex.tryLock() ) return mutex.wait();

        console.log( `Updating hola proxies list: country: ${ country || "-" }` );

        try {
            var res = await fetch( BASE_URL + "/background_init?uuid=" + this.clientId, {
                "method": "post",
                "body": new URLSearchParams( {
                    "login": "1",
                    "ver": EXT_VER,
                } ),
                "browser": true,
            } );

            if ( !res.ok ) throw Error();

            var data = await res.json();

            this.#key = data.key;

            const url =
                BASE_URL +
                "/zgettunnels?" +
                new URLSearchParams( {
                    country, // if country is not set it returns small list of proxies
                    "limit": 9999999,
                    "ping_id": Math.random(),
                    "ext_ver": EXT_VER,
                    "browser": "chrome",
                    "product": "cws",
                    "uuid": this.clientId,
                    "session_key": this.#key,
                    "is_premium": 1,
                } );

            res = await fetch( url, {
                "browser": true,
            } );

            if ( !res.ok ) throw res + "";

            data = await res.json();

            if ( data.blocked ) throw `IP address blocked`;

            for ( const hostname of Object.values( data.ip_list || {} ) ) {
                const proxy = {
                    "protocol": "http:",
                    hostname,
                    "port": 22222,
                    "username": "user-uuid-" + this.clientId,
                    "password": data.agent_key,
                    "remoteAddress": hostname,
                };

                proxies.push( proxy );
            }

            console.log( `Hola proxies list updated: country: ${ country || "-" }, ${ proxies.length } proxies` );
        }
        catch ( e ) {
            console.log( `Hola proxies update error: country: ${ country || "-" }: ${ e }` );
        }

        CACHE.set( country, proxies, DEFAULT_UPDATE_INTERVAL );

        mutex.unlock( proxies );

        return proxies;
    }
}

export default new Hola();
