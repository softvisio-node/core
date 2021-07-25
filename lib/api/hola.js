import fetch from "#lib/fetch";
import { v4 as uuidv4 } from "uuid";
import Mutex from "#lib/threads/mutex";
import CacheLRU from "@softvisio/utils/cache-lru";

const DEFAULT_UPDATE_INTERVAL = 1000 * 60 * 10; // 10 minutes
const BASE_URL = "https://client.hola.org/client_cgi";
const EXT_VER = "1.176.815";
const USER_AGENT = "Mozilla/5.0 (X11; Fedora; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36";

const MUTEX_SET = Mutex.newSet();
const CACHE = new CacheLRU();

class Hola {
    #client_id = uuidv4().replaceAll( "-", "" );
    #key;

    async getProxies ( country ) {
        if ( !country ) country = "";
        else country = country.toLowerCase();

        var proxies = CACHE.get( country );

        if ( proxies ) return proxies;

        proxies = [];

        const mutex = MUTEX_SET.get( country );

        if ( !mutex.tryDown() ) return await mutex.signal.wait();

        console.log( `Updating hola proxies list: country: ${country || "-"}` );

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
                    country, // if country is not set it returns small list of proxies
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

            for ( const hostname of Object.values( data.ip_list ) ) {
                const proxy = {
                    "protocol": "http:",
                    hostname,
                    "port": 22222,
                    "username": "user-uuid-" + this.#client_id,
                    "password": data.agent_key,
                    "remoteAddr": hostname,
                };

                proxies.push( proxy );
            }

            console.log( `Hola proxies list updated: country: ${country || "-"}, ${proxies.length} proxies` );
        }
        catch ( e ) {
            console.log( `Hola proxies update error: country: ${country || "-"}` );
        }

        CACHE.set( country, proxies, DEFAULT_UPDATE_INTERVAL );

        mutex.up();
        mutex.signal.broadcast( proxies );

        return proxies;
    }
}

export default new Hola();
