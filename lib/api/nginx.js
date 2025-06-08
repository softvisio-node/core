import Api from "#lib/api";
import Mutex from "#lib/threads/mutex";

const DEFAULT_API_URL = "ws//nginx:81/api";

export default class NginxApi {
    #appName;
    #serviceName;
    #api;
    #proxies = {};
    #updateId;
    #mutex = new Mutex();

    constructor ( appName, serviceName, { apiUrl } = {} ) {
        this.#appName = appName;
        this.#serviceName = serviceName;
        this.#api = new Api( apiUrl || DEFAULT_API_URL ).on( "disconnect", this.#onDisconnect.bind( this ) );
    }

    // properties
    get appName () {
        return this.#appName;
    }

    get serviceName () {
        return this.#serviceName;
    }

    // public
    async getCertificates ( serverNames ) {
        return this.#api.call( "nginx/get-certificates", serverNames );
    }

    async addProxy ( proxyId, proxyOptions ) {
        if ( !this.#proxies[ proxyId ] ) {
            this.#proxies[ proxyId ] = proxyOptions;

            await this.#createUpdateId();

            this.#update();
        }

        return result( 200 );
    }

    async deleteProxy ( proxyId ) {
        if ( this.#proxies[ proxyId ] ) {
            delete this.#proxies[ proxyId ];

            await this.#createUpdateId();

            this.#update();
        }

        return result( 200 );
    }

    async setServerNames ( proxyId, serverNames ) {
        const proxy = this.#proxies[ proxyId ];

        if ( !proxy ) return result( [ 404, "Nginx proxy not found" ] );

        proxy.serverNames = [ ...new Set( serverNames || [] ) ];

        await this.#createUpdateId();

        return result( 200 );
    }

    // private
    async #createUpdateId () {
        this.#updateId = Date.now();
    }

    async #onDisconnect () {
        this.#update();
    }

    // XXX terminate on abort signal
    async #update () {
        if ( !this.#mutex.tryLock() ) return;

        while ( true ) {
            if ( !this.#api.isConnected ) await this.#api.waitConnect();

            const res = await this.#api.call( "nginx/update-proxies", this.#appName, this.#serviceName, this.#updateId, this.#proxies );

            if ( res.ok ) break;
        }

        this.#mutex.unlock();
    }
}
