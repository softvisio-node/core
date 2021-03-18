const Events = require( "events" );
const redis = require( "../redis" );
const { toMsgPack, fromMsgPack } = require( "../msgpack" );

module.exports = class Cluster extends Events {
    #eventNamePrefix = "event";
    #namespace;
    #redis;
    #isConnected = false;

    #initialized;
    #prefix;
    #wait = [];

    constructor ( options = {} ) {
        super();

        if ( options.onEvent ) this.on( "event", options.onEvent );
        if ( typeof options.eventNamePrefix !== "undefined" ) this.#eventNamePrefix = options.eventNamePrefix;
    }

    get namespace () {
        return this.#namespace;
    }

    async connect ( url, namespace ) {
        if ( this.#initialized ) return;

        this.#initialized = true;

        this.#namespace = namespace;
        this.#prefix = "@cluster/" + this.#namespace + "/";

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

    get isConnected () {
        return this.#isConnected;
    }

    async waitConnect () {
        if ( this.#isConnected ) return;

        return new Promise( resolve => this.#wait.push( resolve ) );
    }

    #onConnect () {
        this.#isConnected = true;

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

        try {
            data = fromMsgPack( data );
        }
        catch ( e ) {
            return;
        }

        super.emit( "event", name, data );

        if ( this.#eventNamePrefix ) super.emit( this.#eventNamePrefix + "/" + name, ...data );
    }

    emit ( name, ...args ) {
        if ( !this.#isConnected ) return false;

        this.#redis.publish( this.#prefix + name, toMsgPack( args ) );

        return true;
    }
};
