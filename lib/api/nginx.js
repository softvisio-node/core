import Api from "#lib/api";

const DEFAULT_API_URL = "ws//nginx:81/api";

export default class NginxApi {
    #api;
    #proxies;
    #proxyAdded;
    #addingProxy;

    constructor ( { apiUrl, ...proxies } = {} ) {
        this.#proxies = proxies;

        this.#api = new Api( apiUrl || DEFAULT_API_URL )
            .on( "disconnect", () => {
                this.#proxyAdded = false;
            } )
            .on( "connect", this.#addProxies.bind( this ) );
    }

    start () {
        this.#addProxies();
    }

    stop () {
        this.#api.call( "nginx/delete-upstream" );
    }

    // private
    async #addProxies () {
        if ( this.#proxyAdded || this.#addingProxy ) return;

        this.#addingProxy = true;

        const res = await this.#api.call( "nginx/add-proxies", this.#proxies );

        this.#addingProxy = false;

        if ( res.ok ) {
            this.#proxyAdded = true;
        }
        else {
            this.#addProxies();
        }
    }
}
