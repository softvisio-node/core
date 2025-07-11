import Api from "#lib/api";
import Events from "#lib/events";
import SharedMutex from "#lib/threads/shared-mutex";

const RESERVED = new Set( [ "connect", "disconnect" ] );

export default class Cluster {
    #app;
    #config;
    #api;
    #sharedMutexesSet;
    #events = new Events();

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;
    }

    // properties
    get app () {
        return this.#app;
    }

    get config () {
        return this.#config;
    }

    get id () {
        return this.#config.id;
    }

    get api () {
        return this.#api;
    }

    get isConnected () {
        return this.#api.isConnected;
    }

    get mutexes () {
        return this.#sharedMutexesSet;
    }

    // public
    async configure () {
        this.#config.id ||= this.app.env.name;

        return result( 200 );
    }

    async init () {
        this.#api = new Api( this.config.url, { "maxConnections": 1 } );

        this.#sharedMutexesSet = new SharedMutex.Set( this.#api, { "clusterId": this.id } );

        this.#events.link( this.#api, {
            "on": name => {
                if ( RESERVED.has( name ) ) {
                    return name;
                }
                else {
                    return `/cluster/${ this.id }/${ name }`;
                }
            },
            "forwarder": ( name, args ) => {
                if ( RESERVED.has( name ) ) {
                    this.#events.emit( name, ...args );
                }
                else {
                    try {
                        let data;

                        if ( args[ 0 ] ) {
                            data = JSON.parse( args[ 0 ] );
                        }

                        if ( !Array.isArray( data ) ) data = [ data ];

                        this.#events.emit( name, ...data );
                    }
                    catch {}
                }
            },
        } );

        return result( 200 );
    }

    async waitConnect ( signal ) {
        return this.#api.waitConnect( signal );
    }

    on ( name, listener ) {
        this.#events.on( name, listener );

        return this;
    }

    once ( name, listener ) {
        this.#events.once( name, listener );

        return this;
    }

    off ( name, listener ) {
        this.#events.off( name, listener );

        return this;
    }

    publish ( name, ...args ) {
        var users;

        if ( typeof name === "object" ) {
            ( { name, users, "data": args } = name );
        }

        if ( RESERVED.has( name ) ) return;

        this.#api.voidCall( "events/publish", this.id, {
            name,
            users,
            "data": JSON.stringify( args ),
        } );
    }
}
