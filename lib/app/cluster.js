import Api from "#lib/api";
import EventsHub from "#lib/events/hub";
import msgpack from "#lib/msgpack";

const RESERVED = new Set( ["connect", "disconnect"] );

export default class Cluster {
    #api;
    #clusterId;
    #prefix;
    #hub = new EventsHub();

    constructor ( clusterId, api ) {
        this.#clusterId = clusterId;
        this.#api = Api.new( api );
        this.#prefix = `cluster://${this.#clusterId}`;

        this.#hub.forwardSubscriptions( this.#api, {
            "on": ( name, listener ) => {
                if ( RESERVED.has( name ) ) this.#api.on( name, listener );
                else this.#api.on( `${this.#prefix}/${name}`, listener );
            },
            "off": ( name, listener ) => {
                if ( RESERVED.has( name ) ) this.#api.off( name, listener );
                else this.#api.off( `${this.#prefix}/${name}`, listener );
            },
            "listener": ( name, args ) => {
                if ( RESERVED.has( name ) ) this.#hub.publish( name, ...args );
                else this.#hub.publish( name, ...msgpack.decode( ...args ) );
            },
        } );
    }

    // properties
    get isConnected () {
        return this.#api.isConnected;
    }

    // public
    async waitConnect () {
        return this.#api.waitConnect();
    }

    on ( name, listener ) {
        this.#hub.on( name, listener );

        return this;
    }

    once ( name, listener ) {
        this.#hub.once( name, listener );

        return this;
    }

    off ( name, listener ) {
        this.#hub.off( name, listener );

        return this;
    }

    publish ( name, ...args ) {
        if ( RESERVED.has( name ) ) return;

        // other cluster
        if ( name.startsWith( "//" ) ) {
            this.#api.callVoid( "cluster/publish", `cluster:${name}`, msgpack.encode( args ) );
        }

        // own cluster
        else {
            this.#api.callVoid( "cluster/publish", `${this.#prefix}/${name}`, msgpack.encode( args ) );
        }
    }
}
