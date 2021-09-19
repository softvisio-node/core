import Events from "#lib/events";
import Redis from "#lib/redis";
import msgpack from "#lib/msgpack";
import Signal from "#lib/threads/signal";
import { randomUUID } from "crypto";

const PREFIX = "/cluster";

export default class Cluster extends Events {
    #url;
    #namespace;

    #clientId;
    #redisSubscriber;
    #redisPublisher;
    #subscriberConnected = false;
    #publisherConnected = false;
    #isConnected = false;
    #subscribed = {};
    #channels = 0;
    #subscribedChannels = 0;
    #signal = new Signal();
    #prefix;

    constructor ( url ) {
        super();

        this.#clientId = randomUUID();

        this.#url = url;

        url = new URL( url );

        this.#namespace = url.searchParams.get( "namespace" );

        this.#prefix = PREFIX + "/" + this.#namespace + "/";

        this.#redisSubscriber = new Redis( this.#url );
        this.#redisPublisher = new Redis( this.#url );

        this.#redisPublisher.on( "error", this.#onError.bind( this ) );
        this.#redisSubscriber.on( "error", this.#onError.bind( this ) );

        this.#redisPublisher.on( "connect", () => {
            this.#publisherConnected = true;
            this.#checkIsConnected();
        } );

        this.#redisPublisher.on( "end", () => {
            this.#publisherConnected = false;
            this.#checkIsConnected();
        } );

        this.#redisSubscriber.on( "connect", () => {
            this.#checkIsConnected();
        } );

        this.#redisSubscriber.on( "end", () => {
            this.#subscribedChannels = 0;
            this.#checkIsConnected();
        } );

        this.#redisSubscriber.on( "subscribe", this.#onSubscribeChange.bind( this ) );
        this.#redisSubscriber.on( "unsubscribe", this.#onSubscribeChange.bind( this ) );
        this.#redisSubscriber.on( "message_buffer", this.#onMessage.bind( this ) );
    }

    // properties
    get clientId () {
        return this.#clientId;
    }

    get isConnected () {
        return this.#isConnected;
    }

    // public
    async waitConnect () {
        if ( this.#isConnected ) return;

        return this.#signal.wait();
    }

    // events
    publish ( name, ...args ) {

        // remove leading "/";
        if ( name.startsWith( "/" ) ) name = name.substr( 1 );

        this.#redisPublisher.publish( this.#prefix + name, msgpack.encode( [this.#clientId, args] ) );
    }

    subscribe ( name ) {

        // remove leading "/";
        if ( name.startsWith( "/" ) ) name = name.substr( 1 );

        // already subscribed
        if ( this.#subscribed[name] ) return;

        this.#subscribed[name] = this.#prefix + name;

        this.#channels++;

        this.#redisSubscriber.subscribe( this.#subscribed[name] );
    }

    unsubscribe ( name ) {

        // remove leading "/";
        if ( name.startsWith( "/" ) ) name = name.substr( 1 );

        // already unsubscribed
        if ( !this.#subscribed[name] ) return;

        this.#channels--;

        this.#redisSubscriber.unsubscribe( this.#subscribed[name] );

        delete this.#subscribed[name];
    }

    // private
    #onSubscribeChange ( name, count ) {
        this.#subscribedChannels = count;

        this.#checkIsConnected();
    }

    #onError ( e ) {
        this.emit( "error", e + "" );
    }

    #onMessage ( name, msg ) {
        try {
            var [clientId, args] = msgpack.decode( msg );
        }
        catch ( e ) {
            return;
        }

        if ( clientId === this.#clientId ) return;

        // remove prefix
        name = name.toString().substr( this.#prefix.length );

        this.emit( "event", name, args );
        this.emit( "event/" + name, ...args );
    }

    #checkIsConnected () {
        const wasConnected = this.#isConnected;

        this.#isConnected = this.#publisherConnected && this.#channels === this.#subscribedChannels;

        // connection status changed
        if ( wasConnected !== this.#isConnected ) {
            if ( this.#isConnected ) {
                this.#signal.broadcast();
                this.emit( "connect" );
            }
            else {
                this.emit( "disconnect" );
            }
        }
    }
}
