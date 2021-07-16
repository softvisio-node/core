import fetch from "#lib/fetch";
import Semaphore from "#lib/threads/semaphore";

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.135 Safari/537.36";

export default class ArchiveOrg extends Semaphore {
    #_agent;

    constructor ( options = {} ) {
        super();

        this.proxy = options.proxy;

        this.maxThreads = options.maxThreads || 10;
    }

    set proxy ( proxy ) {
        this.#agent.proxy = proxy;
    }

    get #agent () {
        if ( !this.#_agent ) this.#_agent = new fetch.Agent();

        return this.#_agent;
    }

    // fields: "urlkey","timestamp","original","mimetype","statuscode","digest","length"
    async getIndex ( domain, options = {} ) {
        const url = `https://web.archive.org/cdx/search/cdx?url=${domain}&matchType=exact&fl=timestamp&filter=statuscode:200&filter=mimetype:text/html&output=json&from=2010&collapse=timestamp:6`;

        const res = await this.runThread( "_thread", url );

        if ( !res.ok ) return res;

        res.data = JSON.parse( res.data );

        const header = res.data.shift();

        res.data = res.data.map( item => Object.fromEntries( item.map( ( field, idx ) => [header[idx], field] ) ) );

        return res;
    }

    async getSnapshot ( domain, timestamp ) {
        const url = `https://web.archive.org/web/${timestamp}/${domain}/`;

        return await this.runThread( "_thread", url );
    }

    async _thread ( url ) {
        const res = await fetch( url, {
            "agent": this.#agent,
            "headers": {
                "User-Agent": USER_AGENT,
            },
        } );

        if ( res.ok ) {
            const data = await res.text();

            return result( 200, data );
        }
        else {
            return result( res );
        }
    }
}
