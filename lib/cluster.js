const Events = require( "./events" );
const redis = require( "./redis" );
const { toMsgPack, fromMsgPack } = require( "./msgpack" );
const Mutex = require( "./threads/mutex" );
const dns = require( "dns" );
const Server = require( "./http/server" );

// const Api = require( "../api" );
// const SERVICE_API_PORT = 39723;

const PREFIX = ":cluster";
const RESERVED_GROUPS_NAMES = new Set( ["local", "threads", "users"] );

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
    #redis;
    #isInitialized = false;
    #isConnected = false;

    #groups;
    #publish;
    #subscribedGroups = 0;

    #wait = [];
    #services = {};

    #rpc;
    #server;

    constructor ( options = {} ) {
        super();

        if ( options.onEvent ) this.on( "event", options.onEvent );
        if ( typeof options.eventNamePrefix !== "undefined" ) this.#eventNamePrefix = options.eventNamePrefix;
    }

    async connect ( url, options = {} ) {
        if ( this.#isInitialized ) return;

        this.#isInitialized = true;

        this.#publish = options.publish || {};
        this.#rpc = options.rpc;

        if ( this.#rpc ) {
            this.#server = new Server();

            // this.server.rpc( this );

            // res = this._listen();
        }

        this.#redis = redis.connect( url );

        // this.#redis.on( "connect", () => this.#onConnect.bind( this ) );

        this.#redis.on( "psubscribe", this.#onSubscribe.bind( this ) );

        this.#redis.on( "end", () => this.#onDisconnect.bind( this ) );

        this.#redis.on( "error", e => this.#onError.bind( this ) );

        this.#redis.on( "pmessage_buffer", this.#onEvent.bind( this ) );

        this.#groups = [PREFIX + "#internal/*"];

        if ( options.groups ) {
            for ( let group of options.groups.split( /,/ ) ) {
                group = group.trim();

                if ( !group ) continue;

                if ( RESERVED_GROUPS_NAMES.has( group ) ) return result( [400, `Group name "${group}" is reserved`] );

                this.#groups.push( PREFIX + ":" + group + "/*" );
            }
        }

        this.#redis.once( "connect", () => this.#redis.psubscribe( ...this.#groups ) );

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

    publish ( name, ...args ) {
        if ( !this.#isInitialized ) return true;

        if ( !this.#isConnected ) return false;

        const event = Events.parseEvent( name, args );

        if ( !event.group ) return false;

        // resolve event group name
        const group = this.#publish[event.group];

        if ( !group ) return false;

        this.#redis.publish( PREFIX + ":" + group + "/" + event.name, toMsgPack( args ) );

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

    #onSubscribe () {
        this.#subscribedGroups++;

        if ( this.#subscribedGroups >= this.#groups.length ) this.#connected();
    }

    #connected () {
        this.#isConnected = true;

        this.#redis.publish( PREFIX + "#internal/service/connect" );

        const wait = this.#wait;
        this.#wait = [];

        for ( const cb of wait ) cb();

        this.emit( "connect" );
    }

    #onDisconnect () {
        this.#isConnected = false;

        this.#subscribedGroups = 0;

        this.emit( "disconnect" );
    }

    #onError ( e ) {
        console.log( "Cluster connection error", e + "" );
    }

    #onEvent ( pattern, name, data ) {

        // remove prefix
        name = name.toString().substr( PREFIX.length );

        if ( name.startsWith( "#internal/" ) ) {
            if ( name === "#internal/service/connect" ) this.#onServiceConnect();

            return;
        }

        // remove group
        name = name.substr( name.indexOf( "/" ) + 1 );

        try {
            data = fromMsgPack( data );
        }
        catch ( e ) {
            return;
        }

        this.emit( "event", name, data );

        if ( this.#eventNamePrefix ) this.emit( this.#eventNamePrefix + "/" + name, ...data );
    }

    #onServiceConnect () {
        for ( const service of Object.values( this.#services ) ) service.update();
    }
};
