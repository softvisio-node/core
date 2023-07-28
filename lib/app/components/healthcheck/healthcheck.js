import Mutex from "#lib/threads/mutex";
import HttpServer from "#lib/http/server";

export default class Healthcheck {
    #app;
    #config;
    #checkHealthMutex = new Mutex();
    #result;
    #lastChecked;
    #server;

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;
    }

    // properties
    get app () {
        return this.#app;
    }

    get config () {
        return this.#config;
    }

    // public
    async start () {
        this.#server = new HttpServer().get( "/", async req => {
            req.end( await this.checkHealth() );
        } );

        const res = await this.#server.start( { "address": "127.0.0.1", "port": this.config.port } );

        if ( !res.ok ) {
            console.log( `Health check server unable to listed socket: ${res.address}:${res.port}` );
        }

        return res;
    }

    async stop () {
        return this.#server?.stop();
    }

    async checkHealth () {
        if ( this.#result && this.#lastChecked && this.#lastChecked + this.#config.interval * 1000 > Date.now() ) return this.#result;

        if ( !this.#checkHealthMutex.tryLock() ) return this.#checkHealthMutex.wait();

        var res = result( 200 );

        // check components
        for ( const component of this.app.components ) {
            res = await component.checkHealth();

            if ( !res.ok ) break;
        }

        // check app
        if ( res.pk ) {
            res = await this.app.checkHealth();
        }

        this.#result = res;
        this.#lastChecked = Date.now();

        this.#checkHealthMutex.unlock( res );

        return res;
    }
}
