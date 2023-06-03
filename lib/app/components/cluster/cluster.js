import Api from "#lib/api";
import Events from "#lib/events";
import SharedMutex from "#lib/threads/shared-mutex";

const RESERVED = new Set( ["connect", "disconnect"] );

export default class Cluster {
    #api;
    #id;
    #sharedMutexesSet;
    #events = new Events();

    constructor ( id, api ) {
        this.#id = id;
        this.#api = Api.new( api, { "maxConnections": 1 } );

        this.#sharedMutexesSet = new SharedMutex.Set( this.#api, { "clusterId": id } );

        this.#events.link( this.#api, {
            "on": name => {
                if ( RESERVED.has( name ) ) {
                    return name;
                }
                else {
                    return `${this.#id}/${name}`;
                }
            },
            "forwarder": ( name, args ) => {
                if ( RESERVED.has( name ) ) {
                    this.#events.emit( name, ...args );
                }
                else {
                    this.#events.emit( name, ...JSON.parse( ...args ) );
                }
            },
        } );
    }

    // properties
    get id () {
        return this.#id;
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
    async waitConnect () {
        return this.#api.waitConnect();
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

        if ( users && !Array.isArray( users ) ) users = [users];

        this.#api.voidCall( "events/publish", this.#id, {
            name,
            users,
            "data": JSON.stringify( args ),
        } );
    }
}
