import Http from "./http.js";
import result from "#lib/result";
import Connection from "./websocket/connection.js";
import Signal from "#lib/threads/signal";
import Mutex from "#lib/threads/mutex";

const CONNECT_INTERVAL = 1000 * 60; // 60 seconds

export default class extends Http {
    #websocketUrl;
    #onRPC; // async function( method, args )
    #eventNamePrefix;

    #maxConnections; // XXX
    #slots = 3; // XXX

    #connectionsHostnames = new Set();
    #connections = [];
    #getConnectionSignal = new Signal();
    #connectClearInterval;
    #connectMutex = new Mutex();

    constructor ( options ) {
        super( options );

        this.#eventNamePrefix = options.eventNamePrefix ?? true;
        this.#onRPC = options.onRPC;
    }

    get websocketUrl () {
        if ( !this.#websocketUrl ) {
            const url = new URL( this.url );

            if ( url.protocol === "http:" ) url.protocol = "ws:";
            else if ( url.protocol === "https:" ) url.protocol = "wss:";

            url.username = "";
            url.password = "";
            url.search = "";
            url.hash = "";

            this.#websocketUrl = url;
        }

        return this.#websocketUrl;
    }

    set url ( value ) {
        super.url = null;

        this.#websocketUrl = null;

        // close connection if url was updated
        this.#close();
    }

    set token ( value ) {

        // close connection if token was updated
        this.#close();
    }

    set persistent ( value ) {
        if ( this.persistent ) this._connectWebSocket();
        else this.#close();
    }

    set pongInterval ( value ) {
        this.#startPong();
    }

    get onRPC () {
        return this.#onRPC;
    }

    // public
    async getConnection () {
        while ( 1 ) {
            if ( this.#connections.length ) {
                const connection = this.#connections.shift();

                this.#connections.push( connection );

                return connection;
            }
            else {
                await this.#getConnectionSignal.wait();
            }
        }
    }

    async call ( method, ...args ) {

        // add api version to the method
        if ( method.charAt( 0 ) !== "/" ) {
            method = `/${this.version}/${method}`;
        }

        if ( !args.length ) args = undefined;

        if ( !this.persistent ) return super._callHTTP( method, args );

        const connection = await this.getConnection();

        if ( !connection ) return result( [500, `Unable to create connection`] );

        return connection.call( method, ...args );
    }

    async callVoid ( method, ...args ) {

        // add api version to the method
        if ( method.charAt( 0 ) !== "/" ) {
            method = `/${this.version}/${method}`;
        }

        if ( !args.length ) args = undefined;

        if ( !this.persistent ) return super._callVoidHTTP( method, args );

        const connection = await this.getConnection();

        if ( connection ) connection.callVoid( method, ...args );
    }

    publish ( name, ...args ) {
        if ( !this.persistent ) return false;

        for ( const connection of this.#connections ) connection.publish( name, ...args );

        return true;
    }

    // protected
    async _connectWebSocket () {
        if ( !this.persistent ) return;

        if ( !this.#connectMutex.tryDown() ) return;

        if ( !this.#connectClearInterval ) this.#connectClearInterval = setInterval( () => this._connectWebSocket(), CONNECT_INTERVAL );

        if ( this.#slots <= 0 ) return;

        const url = this.websocketUrl;

        const records = await this._lookup( url.hostname );

        if ( !records ) return;

        for ( const record of records ) {
            const hostname = record.address;

            if ( this.#connectionsHostnames.has( hostname ) ) continue;

            this.#slots--;

            const connection = new Connection( this, hostname, url );

            connection.on( "open", this.#onConnectionOpen.bind( this ) );
            connection.on( "close", this.#onConnectionClose.bind( this ) );
            connection.on( "event", this.#onConnectionEvent.bind( this ) );

            this.#connectionsHostnames.add( connection.hostname );
            this.#connections.push( connection );

            this.#getConnectionSignal.broadcast();

            if ( this.#slots <= 0 ) break;
        }

        this.#connectMutex.up();
    }

    // private
    #onConnectionOpen ( connection ) {
        this.emit( "open" );
    }

    #onConnectionClose ( connection, res ) {
        this.#slots++;

        this.#connectionsHostnames.delete( connection.hostname );

        for ( let n = 0; n < this.#connections.length; n++ ) {
            if ( this.#connections[n] === connection ) {
                this.#connections.splice( n, 1 );

                break;
            }
        }

        this.emit( "close", res );

        // reconnect
        this._connectWebSocket();
    }

    #onConnectionEvent ( name, args ) {
        this.emit( "event", name, args );

        if ( this.#eventNamePrefix ) this.emit( "event/" + name, ...args );
    }

    #close () {
        for ( const connection of this.#connections ) connection.close();
    }

    #startPong () {
        if ( !this.persistent ) return;

        for ( const connection of this.#connections ) connection.startPong();
    }
}
