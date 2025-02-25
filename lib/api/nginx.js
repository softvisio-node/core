import Api from "#lib/api";

const DEFAULT_API_URL = "ws//nginx:81/api";

export default class NginxApi {
    #api;
    #proxies = {};

    constructor ( name, upstreamPort, { apiUrl, ...options } = {} ) {
        apiUrl ||= DEFAULT_API_URL;

        this.#api = new Api( apiUrl );

        this.#start();
    }

    // public
    getProxy ( id, upstreamPort ) {
        return this.#proxies[ id + ":" + upstreamPort ];
    }

    deleteProxy ( id, upstreamPort ) {}

    async addProxy () {
        return this.#call( "add-proxy" );
    }

    // private
    async #start () {}

    async #call ( method, ...args ) {
        return this.#api.call( method, ...args );
    }
}
