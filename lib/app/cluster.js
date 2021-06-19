import Events from "#lib/events";
import redis from "#lib/redis";
import MSGPACK from "#lib/msgpack";
import Server from "#lib/app/server";
import RPC from "./api/rpc.js";

const SERVICE_API_PORT = 8080;
const PREFIX = ":cluster";
const RESERVED_GROUPS_NAMES = new Set( ["local", "threads", "users"] );

export default class Cluster extends Events {
    #redis;
    #isInitialized = false;
    #isConnected = false;

    #groups;
    #publish;
    #subscribedGroups = 0;

    #wait = [];

    #server;

    get isInitialized () {
        return this.#isInitialized;
    }

    get isConnected () {
        return this.#isConnected;
    }

    get isBlocked () {
        return this.#isInitialized && !this.#isConnected;
    }

    get server () {
        return this.#server;
    }

    // public
    async waitConnect () {
        if ( this.#isConnected ) return;

        return new Promise( resolve => this.#wait.push( resolve ) );
    }

    publish ( name, ...args ) {
        if ( !this.#isInitialized ) return true;

        if ( !this.#isConnected ) return false;

        this.#redis.publish( PREFIX + "/" + name, MSGPACK.encode( args ) );

        return true;
    }

    // XXX
    subscribe ( name ) {}

    // XXX
    unsubscribe ( name ) {}

    // private
    async connect ( url, options = {} ) {
        if ( this.#isInitialized ) return;

        this.#isInitialized = true;

        this.#publish = options.publish || {};

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

    async listen ( rpc ) {
        if ( !( rpc instanceof RPC ) ) throw Error( `RPC object is not valid` );

        this.#server = new Server();

        this.#server.api( "/", rpc );

        const res = await this.#server.listen( "0.0.0.0", SERVICE_API_PORT );

        return res;
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

    #onEvent ( pattern, name, args ) {

        // remove prefix
        name = name.toString().substr( PREFIX.length );

        // remove group
        name = name.substr( name.indexOf( "/" ) + 1 );

        try {
            args = MSGPACK.decode( args );
        }
        catch ( e ) {
            return;
        }

        this.emit( "event", name, args );
        this.emit( "event/" + name, ...args );
    }
}
