import Api from "#lib/api";

const DEFAULT_API_URL = "ws//nginx:81/api";

export default class NginxApi {
    #api;
    #proxyName;
    #upstreamPort;
    #proxyOptions;
    #addingProxy;

    constructor ( proxyName, upstreamPort, { apiUrl, ...proxyOptions } = {} ) {
        apiUrl ||= DEFAULT_API_URL;

        this.#api = new Api( apiUrl );

        this.#proxyName = proxyName;
        this.#upstreamPort = upstreamPort;
        this.#proxyOptions = proxyOptions;

        this.#api.on( "disconnect", () => this.#addProxy() );

        this.#addProxy();
    }

    // private
    async #addProxy () {
        if ( this.#addingProxy ) return;

        this.#addingProxy = true;

        const res = await this.#api.call( "nginx/add-proxy", this.#proxyName, this.#upstreamPort, this.#proxyOptions );

        this.#addingProxy = false;

        if ( !res.ok ) this.#addProxy();
    }
}
