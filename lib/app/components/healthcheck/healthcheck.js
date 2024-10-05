import HttpServer from "#lib/http/server";
import Interval from "#lib/interval";
import Mutex from "#lib/threads/mutex";

export default class Healthcheck {
    #app;
    #config;
    #started;
    #checkHealthMutex = new Mutex();
    #result;
    #lastChecked;
    #server;
    #interval;

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;

        this.#interval = new Interval( this.#config.interval );
    }

    // properties
    get app () {
        return this.#app;
    }

    get config () {
        return this.#config;
    }

    // public
    async init () {
        this.#server = new HttpServer().get( "/", async req => {
            req.end( await this.checkHealth() );
        } );

        const res = await this.#server.start( { "address": "127.0.0.1", "port": this.config.port } );

        if ( !res.ok ) {
            console.log( `Health check server unable to listed socket: ${ res.address }:${ res.port }` );
        }

        return res;
    }

    async start () {
        this.#started = true;

        return result( 200 );
    }

    async stop () {
        this.#started = false;

        return this.#server?.stop();
    }

    async checkHealth () {

        // disabled
        if ( !this.#config.enabled ) {
            this.#result ??= result( 200 );

            return this.#result;
        }

        // not started
        if ( !this.#started ) {
            return result( 503 );
        }

        if ( this.#result && this.#lastChecked && this.#lastChecked + this.#interval.toMilliseconds() > Date.now() ) return this.#result;

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
