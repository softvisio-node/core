const Events = require( "events" );
const redis = require( "../redis" );
const { toMsgPack, fromMsgPack } = require( "../utils" );

module.exports = class Cluster extends Events {
    #eventNamePrefix = "event";
    #redis;
    #isConnected = false;

    constructor ( options = {} ) {
        super();

        if ( options.onEvent ) this.on( "event", options.onEvent );
        if ( typeof options.eventNamePrefix !== "undefined" ) this.#eventNamePrefix = options.eventNamePrefix;
    }

    // XXX subscribe
    async connect ( url ) {
        return new Promise( resolve => {
            this.#redis = redis.connect( url );

            this.#redis.on( "connect", () => this.#onConnect.bind( this ) );

            this.#redis.on( "end", () => this.#onDisconnect.bind( this ) );

            this.#redis.on( "error", e => this.#onError.bind( this ) );

            this.#redis.once( "connect", () => {
                this.#redis.psubscribe( "cluster/\\*/*", "cluster/@service/*" );

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
        try {
            data = fromMsgPack( data );
        }
        catch ( e ) {
            return;
        }

        channel = channel.toString();

        super.emit( "event", channel, ...data );

        if ( this.#eventNamePrefix ) super.emit( this.#eventNamePrefix + "/" + channel, ...data );
    }

    emit ( name, ...args ) {
        if ( !this.#isConnected ) return false;

        const idx = name.indexOf( "/" ),
            services = name.substring( 0, idx );

        name = name.substr( idx + 1 );

        for ( const service of services.split( "," ) ) {
            this.#redis.publish( service + "/" + name, toMsgPack( args ) );
        }

        return true;
    }
};
