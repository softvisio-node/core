const Events = require( "events" );
const redis = require( "./redis" );
const { toMsgPack, fromMsgPack } = require( "./msgpack" );
const Mutex = require( "./threads/mutex" );
const dns = require( "dns" );
const server = require( "./http/server" );

// const Api = require( "../api" );

// const SERVICE_API_PORT = 39723;

class Service {
    #name;
    #mutex = new Mutex();
    #connections = {};

    constructor ( name ) {
        this.#name = name;
    }

    // XXX
    async update () {
        if ( this.#mutex.tryDown() ) {
            const res = await dns.promises.resolve4( "tasks." + this.#name );

            console.log( res );

            this.#mutex.signal.broadcast();

            this.#mutex.up();
        }
        else {
            await this.#mutex.signal.wait();
        }
    }

    // XXX
    async call ( method, args, callVoid ) {
        return result( 500 );
    }
}

module.exports = class Cluster extends Events {
    #eventNamePrefix = "event";
    #namespace;
    #redis;
    #isInitialized = false;
    #isConnected = false;

    #prefix;
    #wait = [];
    #services = {};

    #rpc;
    #server;

    constructor ( options = {} ) {
        super();

        if ( options.onEvent ) this.on( "event", options.onEvent );
        if ( typeof options.eventNamePrefix !== "undefined" ) this.#eventNamePrefix = options.eventNamePrefix;
    }

    get namespace () {
        return this.#namespace;
    }

    async connect ( url, namespace, rpc ) {
        if ( this.#isInitialized ) return;

        this.#isInitialized = true;

        this.#namespace = namespace;
        this.#prefix = "@cluster/" + this.#namespace + "/";
        this.#rpc = rpc;

        if ( this.#rpc ) {
            this.#server = server( {} );

            // this.server.rpc( this );

            // res = this._listen();
        }

        this.#redis = redis.connect( url );

        // this.#redis.on( "connect", () => this.#onConnect.bind( this ) );
        this.#redis.on( "psubscribe", this.#onConnect.bind( this ) );

        this.#redis.on( "end", () => this.#onDisconnect.bind( this ) );

        this.#redis.on( "error", e => this.#onError.bind( this ) );

        this.#redis.on( "pmessage_buffer", this.#onEvent.bind( this ) );

        this.#redis.once( "connect", () => this.#redis.psubscribe( this.#prefix + "*" ) );

        await this.waitConnect();

        return result( 200 );
    }

    get isInitialized () {
        return this.#isInitialized;
    }

    get isConnected () {
        return this.#isConnected;
    }

    get isBlocked () {
        return this.#isInitialized && !this.#isConnected;
    }

    async waitConnect () {
        if ( this.#isConnected ) return;

        return new Promise( resolve => this.#wait.push( resolve ) );
    }

    emit ( name, ...args ) {
        if ( !this.#isConnected ) return false;

        this.#redis.publish( this.#prefix + name, toMsgPack( args ) );

        return true;
    }

    async call ( method, ...args ) {
        return this.#call( method, args, false );
    }

    callVoid ( method, ...args ) {
        this.#call( method, args, true );
    }

    async #call ( method, args, callVoid ) {
        const index = method.indexOf( "/" ),
            serviceName = method.substr( 0, index );

        method = method.substr( index + 1 );

        var service = this.#services[serviceName];
        if ( !service ) service = this.#services[serviceName] = new Service( serviceName );

        return service.call( method, args, callVoid );
    }

    #onConnect () {
        this.#isConnected = true;

        this.#redis.publish( this.#prefix + "cluster/service/connect" );

        const wait = this.#wait;
        this.#wait = [];

        for ( const cb of wait ) cb();

        super.emit( "connect" );
    }

    #onDisconnect () {
        this.#isConnected = false;

        super.emit( "disconnect" );
    }

    #onError ( e ) {
        console.log( "Cluster connection error", e + "" );
    }

    #onEvent ( pattern, name, data ) {

        // remove prefix
        name = name.toString().substr( this.#prefix.length );

        if ( name.startsWith( "*/" ) ) return;

        if ( name.startsWith( "@" ) && !name.startsWith( "@" ) ) return;

        if ( name === "cluster/service-connect" ) {
            this.#onServiceConnect();

            return;
        }

        try {
            data = fromMsgPack( data );
        }
        catch ( e ) {
            return;
        }

        super.emit( "event", name, data );

        if ( this.#eventNamePrefix ) super.emit( this.#eventNamePrefix + "/" + name, ...data );
    }

    #onServiceConnect () {
        for ( const service of Object.values( this.#services ) ) service.update();
    }
};
