import Events from "#lib/events";
import Redis from "#lib/redis";
import MSGPACK from "#lib/msgpack";
import Signal from "#lib/threads/signal";

const PREFIX = "/cluster";

export default class Cluster extends Events {
    #url;
    #namespace;

    #redis;
    #isInitialized = false;
    #isConnected = false;
    #subscribed = {};
    #channels = 0;
    #subscribedChannels = 0;
    #signal = new Signal();
    #prefix;

    // properties
    get isInitialized () {
        return this.#isInitialized;
    }

    get isConnected () {
        return this.#isConnected;
    }

    get isSubscribed () {
        return this.#channels === this.#subscribedChannels;
    }

    get isReady () {
        if ( !this.#redis ) return true;

        return this.isConnected && this.isSubscribed;
    }

    // public
    async init ( options = {} ) {
        if ( this.#isInitialized ) return result( [400, `Already initialized`] );

        this.#isInitialized = true;

        this.#url = options.url;
        this.#namespace = options.namespace;

        // init cluster
        if ( this.#url && this.#namespace ) {
            this.#prefix = PREFIX + "/" + this.#namespace + "/";

            this.#redis = new Redis( this.#url );

            this.#redis.on( "connect", this.#onConnect.bind( this ) );
            this.#redis.on( "end", this.#onDisconnect.bind( this ) );
            this.#redis.on( "error", this.#onError.bind( this ) );

            this.#redis.on( "subscribe", this.#onSubscribeChange.bind( this ) );
            this.#redis.on( "unsubscribe", this.#onSubscribeChange.bind( this ) );
            this.#redis.on( "message_buffer", this.#onEvent.bind( this ) );

            await this.waitReady();
        }

        return result( 200 );
    }

    async waitReady () {
        if ( this.isReady ) return;

        return this.#signal.wait();
    }

    // events
    publish ( name, ...args ) {
        if ( !this.#isInitialized ) return;
        if ( !this.#redis ) return;

        // remove leading "/";
        if ( name.startsWith( "/" ) ) name = name.substr( 1 );

        this.#redis.publish( this.#prefix + name, MSGPACK.encode( args ) );
    }

    subscribe ( name ) {
        if ( !this.#redis ) return;

        // remove leading "/";
        if ( name.startsWith( "/" ) ) name = name.substr( 1 );

        // already subscribed
        if ( this.#subscribed[name] ) return;

        this.#subscribed[name] = this.#prefix + name;

        this.#channels++;

        this.#redis.subscribe( this.#subscribed[name] );
    }

    unsubscribe ( name ) {
        if ( !this.#redis ) return;

        // remove leading "/";
        if ( name.startsWith( "/" ) ) name = name.substr( 1 );

        // already unsubscribed
        if ( !this.#subscribed[name] ) return;

        this.#channels--;

        this.#redis.unsubscribe( this.#subscribed[name] );

        delete this.#subscribed[name];
    }

    // private
    #onSubscribeChange ( name, count ) {
        this.#subscribedChannels = count;

        if ( this.isReady ) {
            this.#signal.broadcast();

            this.emit( "ready" );
        }
    }

    #onConnect () {
        this.#isConnected = true;

        if ( this.isReady ) {
            this.#signal.broadcast();

            this.emit( "ready" );
        }
    }

    #onDisconnect () {
        this.#isConnected = false;

        this.emit( "disconnect" );
    }

    #onError ( e ) {
        this.emit( "error", e + "" );
    }

    #onEvent ( name, args ) {
        try {
            args = MSGPACK.decode( args );
        }
        catch ( e ) {
            return;
        }

        // remove prefix
        name = name.toString().substr( this.#prefix.length );

        this.emit( "event", name, args );
        this.emit( "event/" + name, ...args );
    }
}
