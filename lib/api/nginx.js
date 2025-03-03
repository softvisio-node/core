import Api from "#lib/api";
import ActivityController from "#lib/threads/activity-controller";

const DEFAULT_API_URL = "ws//nginx:81/api";

export default class NginxApi {
    #api;
    #proxyId;
    #proxyOptions;
    #serverNames;
    #activityController;
    #abortController = new AbortController();

    constructor ( { apiUrl, proxyId, proxyOptions } = {} ) {
        this.#proxyId = proxyId;
        this.#proxyOptions = structuredClone( proxyOptions );

        this.#serverNames = this.#parseServerNames( proxyOptions.serverNames );

        this.#activityController = new ActivityController( {
            "doStart": this.#doStart.bind( this ),
            "doStop": this.#doStop.bind( this ),
        } );

        this.#api = new Api( apiUrl || DEFAULT_API_URL ).on( "disconnect", this.#onDisconnect.bind( this ) );
    }

    start () {
        return this.#activityController.start();
    }

    stop () {
        this.#abortController.abort();

        this.#abortController = new AbortController();

        return this.#activityController.stop();
    }

    async getCertificates ( serverNames ) {
        return this.#api.call( "nginx/get-certificates", serverNames );
    }

    async setServerNames ( serverNames ) {
        this.#serverNames = this.#parseServerNames( serverNames );

        return this.#api.call( "nginx/set-server-names", [ ...this.#serverNames ] );
    }

    async addServerNames ( serverNames ) {
        serverNames = [ ...this.#parseServerNames( serverNames ) ];

        for ( const serverName of serverNames ) {
            this.#serverNames.add( serverName );
        }

        return this.#api.call( "nginx/add-server-names", serverNames );
    }

    async deleteServerNames ( serverNames ) {
        serverNames = [ ...this.#parseServerNames( serverNames ) ];

        for ( const serverName of serverNames ) {
            this.#serverNames.delete( serverName );
        }

        return this.#api.call( "nginx/delete-server-names", serverNames );
    }

    // private
    #parseServerNames ( serverNames ) {
        if ( !Array.isArray( serverNames ) ) serverNames = [ serverNames ];

        return new Set( serverNames.filter( serverName => serverName ) );
    }

    async #doStart () {
        await this.#api.waitConnect( this.#abortController.signal );

        if ( !this.#api.isConnected ) return result( [ 400, "Aborted" ] );

        const res = await this.#api.call( "nginx/add-proxy", this.#proxyId, {
            ...this.#proxyOptions,
            "serverNames": [ ...this.#serverNames ],
        } );

        return res;
    }

    async #doStop () {
        if ( this.#api.isConnected ) {
            await this.#api.call( "nginx/delete-upstream" );
        }

        return result( 200 );
    }

    async #onDisconnect () {

        // restart
        if ( this.#activityController.isStarted ) {
            await this.stop();

            await this.start();
        }
    }
}
