import Api from "#lib/api";

const DEFAULT_API_URL = "ws//nginx:81/api";

export default class NginxApi {
    #api;
    #proxyId;
    #upstreamPort;
    #proxyOptions;
    #proxyAdded;
    #addingProxy;

    constructor ( proxyId, upstreamPort, { apiUrl, ...proxyOptions } = {} ) {
        this.#proxyId = proxyId;
        this.#upstreamPort = upstreamPort;
        this.#proxyOptions = proxyOptions;

        this.#api = new Api( apiUrl || DEFAULT_API_URL )
            .on( "disconnect", () => {
                this.#proxyAdded = false;
            } )
            .on( "connect", this.#addProxy.bind( this ) );
    }

    // private
    async #addProxy () {
        if ( this.#proxyAdded || this.#addingProxy ) return;

        this.#addingProxy = true;

        const res = await this.#api.call( "nginx/add-proxy", this.#proxyId, {
            ...this.#proxyOptions,
            "upstreamPort": this.#upstreamPort,
        } );

        this.#addingProxy = false;

        if ( res.ok ) {
            this.#proxyAdded = true;
        }
        else {
            this.#addProxy();
        }
    }
}
