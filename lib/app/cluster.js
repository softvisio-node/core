import msgpack from "#lib/msgpack";
import Api from "#lib/api";

export default class Cluster {
    #app;
    #api;
    #clusterId;
    #prefix;
    #listener = this.#listenerTemplate.bind( this );

    constructor ( clusterId, app, api ) {
        this.#clusterId = clusterId;
        this.#app = app;
        this.#api = Api.new( api );

        this.#prefix = `cluster/${this.#clusterId}`;

        this.#api.on( "connect", () => this.#app.publish( "cluster/connect" ) );
        this.#api.on( "disconnect", () => this.#app.publish( "cluster/disconnect" ) );

        this.#app.hub.watch( "local", ( type, queue, name ) => {
            if ( !name.startsWith( "/" ) ) return;

            const route = `${this.#prefix}:local:${name}`;

            if ( type === "subscribe" ) this.#api.on( route, this.#listener );
            else if ( type === "unsubscribe" ) this.#api.off( route, this.#listener );
        } );

        this.#app.hub.watch( "threads/out", ( type, queue, name ) => {
            if ( !name.startsWith( "/" ) ) return;

            const route = `${this.#prefix}:local:${name}`;

            if ( type === "subscribe" ) this.#api.on( route, this.#listener );
            else if ( type === "unsubscribe" ) this.#api.off( route, this.#listener );
        } );

        this.#app.hub.watch( "api/out", ( type, queue, name ) => {
            const route = `${this.#prefix}:${queue}:${name}`;

            if ( type === "subscribe" ) this.#api.on( route, this.#listener );
            else if ( type === "unsubscribe" ) this.#api.off( route, this.#listener );
        } );

        this.#app.hub.watch( "rpc/out", ( type, queue, name ) => {
            const route = `${this.#prefix}:${queue}:${name}`;

            if ( type === "subscribe" ) this.#api.on( route, this.#listener );
            else if ( type === "unsubscribe" ) this.#api.off( route, this.#listener );
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

    publish ( queue, name, args ) {
        const route = `${this.#prefix}:${queue}:${name}`;

        const body = msgpack.encode( [queue, name, args] );

        this.#api.callVoid( "cluster/publish", route, body );
    }

    // private
    #listenerTemplate ( body ) {
        const args = msgpack.decode( body );

        this.#app.publish( ":cluster", ...args );
    }
}
