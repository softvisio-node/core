import Events from "#lib/events";
import msgpack from "#lib/msgpack";
import Api from "#lib/api";

const PREFIX = "/cluster";

export default class Cluster extends Events {
    #api;
    #id;
    #prefix;
    #subscribedEvents = {};

    constructor ( id, api ) {
        super();

        if ( !( api instanceof Api ) ) api = Api.new( api );

        this.#api = api;
        this.#id = id;
        this.#prefix = PREFIX + "/" + this.#id + "/";

        this.#api.on( "connect", this.#onConnect.bind( this ) );
        this.#api.on( "disconnect", () => this.emit( "disconnect" ) );
        this.#api.on( "event", this.#onEvent.bind( this ) );
    }

    // properties
    get isConnected () {
        return this.#api.isConnected;
    }

    // public
    async waitConnect () {
        return this.#api.waitConnect();
    }

    // events
    async subscribe ( name ) {

        // already subscribed
        if ( this.#subscribedEvents[name] ) return;

        this.#subscribedEvents[name] = this.#prefix + name;

        return this.#api.call( "events/subscribe", [this.#subscribedEvents[name]] );
    }

    async unsubscribe ( name ) {

        // already unsubscribed
        if ( !this.#subscribedEvents[name] ) return;

        this.#api.call( "events/unsubscribe", [this.#subscribedEvents[name]] );

        delete this.#subscribedEvents[name];
    }

    async publish ( name, ...args ) {

        // to the other cluster
        if ( name.charAt( 0 ) === "/" ) {
            name = PREFIX + name;
        }

        // to the own cluster
        else {
            name = this.#prefix + name;
        }

        return this.#api.call( "events/publish", name, ...( args.length ? [msgpack.encode( args )] : [] ) );
    }

    // private
    #onConnect ( name, args ) {
        const names = Object.values( this.#subscribedEvents );

        if ( names.length ) this.#api.call( "events/subscribe", names );

        this.emit( "connect" );
    }

    #onEvent ( name, args ) {
        name = name.substr( this.#prefix.length );

        try {
            if ( args[0] ) args = msgpack.decode( args[0] );
        }
        catch ( e ) {
            return;
        }

        this.emit( "event", name, args );
        this.emit( "event/" + name, ...args );
    }
}
