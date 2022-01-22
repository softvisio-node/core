import msgpack from "#lib/msgpack";
import Api from "#lib/api";

const PREFIX = "cluster";

export default class Cluster {
    #app;
    #api;
    #namespace;
    #prefix;
    #listener = this.#listenerTemplate.bind( this );

    constructor ( namespace, app, api ) {
        this.#namespace = namespace;
        this.#app = app;
        this.#api = Api.new( api );

        this.#prefix = PREFIX + "/" + this.#namespace + "/";

        this.#api.on( "connect", () => this.#app.publish( "cluster/connect" ) );
        this.#api.on( "disconnect", () => this.#app.publish( "cluster/disconnect" ) );

        this.#app.hub.watch( "local", ( type, prefix, name ) => {
            if ( !name.startsWith( "/" ) ) return;

            const route = this.#prefix + prefix + "/" + name;

            if ( type === "subscribe" ) this.#api.on( route, args => this.#listener );
            else if ( type === "unsubscribe" ) this.#api.off( route );
        } );

        this.#app.hub.watch( "api/out", ( type, prefix, name ) => {
            const route = this.#prefix + prefix + "/" + name;

            if ( type === "subscribe" ) this.#api.on( route, args => this.#listener );
            else if ( type === "unsubscribe" ) this.#api.off( route );
        } );

        this.#app.hub.watch( "rpc/out", ( type, prefix, name ) => {
            const route = this.#prefix + prefix + "/" + name;

            if ( type === "subscribe" ) this.#api.on( route, args => this.#listener );
            else if ( type === "unsubscribe" ) this.#api.off( route );
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

    publish ( prefix, name, args ) {
        const route = this.#prefix + prefix + "/" + name;

        const body = msgpack.encode( [prefix, name, args] );

        this.#api.callVoid( "cluster/publish", route, body );
    }

    // private
    #listenerTemplate ( body ) {
        const args = msgpack.decode( body );

        this.#app.hub.publish( ...args );
    }
}
