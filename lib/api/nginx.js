import Api from "#lib/api";

const DEFAULT_API_URL = "ws//nginx:81/api";

export default class NginxApi {
    #api;
    #proxyName;
    #upstreamPort;
    #proxyOptions;

    constructor ( proxyName, upstreamPort, { apiUrl, ...proxyOptions } = {} ) {
        apiUrl ||= DEFAULT_API_URL;

        this.#api = new Api( apiUrl );

        this.#proxyName = proxyName;
        this.#upstreamPort = upstreamPort;
        this.#proxyOptions = proxyOptions;

        this.#addProxy();
    }

    // private
    async #addProxy () {
        const res = await this.#api.call( "add-proxy", this.#proxyName, this.#upstreamPort, this.#proxyOptions );

        if ( res.ok ) {
            this.#api.on( "disconnect", () => this.#addProxy() );
        }
        else {
            this.#addProxy();
        }
    }
}
