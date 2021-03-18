const Events = require( "events" );
const redis = require( "../redis" );
const { toMsgPack, fromMsgPack } = require( "../utils" );

module.exports = class Cluster extends Events {
    #eventNamePrefix = "event";
    #namespace;
    #redis;
    #isConnected = false;

    #prefix;

    constructor ( options = {} ) {
        super();

        if ( options.onEvent ) this.on( "event", options.onEvent );
        if ( typeof options.eventNamePrefix !== "undefined" ) this.#eventNamePrefix = options.eventNamePrefix;
    }

    get namespace () {
        return this.#namespace;
    }

    // XXX resolve after subscribed
    async connect ( url, namespace ) {
        this.#namespace = namespace;
        this.#prefix = "cluster/" + this.#namespace + "/";

        return new Promise( resolve => {
            this.#redis = redis.connect( url );

            this.#redis.on( "connect", () => this.#onConnect.bind( this ) );

            this.#redis.on( "end", () => this.#onDisconnect.bind( this ) );

            this.#redis.on( "error", e => this.#onError.bind( this ) );

            this.#redis.once( "connect", () => {
                this.#redis.psubscribe( this.#prefix + "*" );

                this.#redis.on( "pmessage_buffer", ( pattern, channel, message ) => this.#onEvent.bind( this ) );

                resolve( result( 200 ) );
            } );
        } );
    }

    get isConnected () {
        return this.#isConnected;
    }

    async #onConnect () {
        this.#isConnected = true;

        super.emit( "connected" );
    }

    async #onDisconnect () {
        this.#isConnected = false;

        super.emit( "disconnected" );
    }

    async #onError ( e ) {
        console.log( "Cluster connection error", e + "" );
    }

    async #onEvent ( pattern, channel, data ) {

        // remove prefix
        channel = channel.toString().substr( this.#prefix.length );

        if ( name.startsWith( "*/" ) ) return;

        if ( name.startsWith( "@" ) && !name.startsWith( "@" ) ) return;

        try {
            data = fromMsgPack( data );
        }
        catch ( e ) {
            return;
        }

        super.emit( "event", channel, ...data );

        if ( this.#eventNamePrefix ) super.emit( this.#eventNamePrefix + "/" + channel, ...data );
    }

    emit ( name, ...args ) {
        if ( !this.#isConnected ) return false;

        this.#redis.publish( this.#prefix + name, toMsgPack( args ) );

        return true;
    }
};
