import Api from "#lib/api";
import ActivityController from "#lib/threads/activity-controller";

const DEFAULT_API_URL = "ws//nginx:81/api";

export default class NginxApi {
    #api;
    #proxies;
    #activityController;
    #abortController = new AbortController();

    constructor ( { apiUrl, ...proxies } = {} ) {
        this.#proxies = proxies;

        this.#activityController = new ActivityController( {
            "doStart": this.#doStart.bind( this ),
            "doStop": this.#doStop.bind( this ),
        } );

        this.#api = new Api( apiUrl || DEFAULT_API_URL ).on( "disconnect", this.stop.bind( this ) );
    }

    start () {
        return this.#activityController.start();
    }

    stop () {
        this.#abortController.abort();

        this.#abortController = new AbortController();

        return this.#activityController.stop();
    }

    // private
    async #doStart () {
        await this.#api.waitConnect( this.#abortController.signal );

        if ( !this.#api.isConnected ) return result( [ 400, "Aborted" ] );

        const res = await this.#api.call( "nginx/add-proxies", this.#proxies );

        return res;
    }

    async #doStop () {
        if ( this.#api.isConnected ) {
            await this.#api.call( "nginx/delete-upstream" );
        }

        return result( 200 );
    }
}
