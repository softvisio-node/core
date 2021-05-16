import Events, { parseGroup } from "#lib/events";
import redis from "#lib/redis";
import MSGPACK from "#lib/msgpack";
import Server from "#lib/http/server";

const SERVICE_API_PORT = 8080;
const PREFIX = ":cluster";
const RESERVED_GROUPS_NAMES = new Set( ["local", "threads", "users"] );

export default class Cluster extends Events {
    #eventNamePrefix;
    #redis;
    #isInitialized = false;
    #isConnected = false;

    #groups;
    #publish;
    #subscribedGroups = 0;

    #wait = [];

    #server;

    constructor ( options = {} ) {
        super();

        this.#eventNamePrefix = options.eventNamePrefix ?? true;
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

    // public
    publish ( name, ...args ) {
        if ( !this.#isInitialized ) return true;

        if ( !this.#isConnected ) return false;

        const event = parseGroup( name, args );

        if ( !event.group ) return false;

        // resolve event group name
        const group = this.#publish[event.group];

        if ( !group ) return false;

        this.#redis.publish( PREFIX + ":" + group + "/" + event.name, MSGPACK.encode( args ) );

        return true;
    }

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
        this.#server = new Server();

        this.#server.api( "/", rpc );

        const res = await this.#server.listen( "0.0.0.0", SERVICE_API_PORT, true );

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

    #onEvent ( pattern, name, data ) {

        // remove prefix
        name = name.toString().substr( PREFIX.length );

        // remove group
        name = name.substr( name.indexOf( "/" ) + 1 );

        try {
            data = MSGPACK.decode( data );
        }
        catch ( e ) {
            return;
        }

        this.emit( "event", name, data );

        if ( this.#eventNamePrefix ) this.emit( "event/" + name, ...data );
    }
}
