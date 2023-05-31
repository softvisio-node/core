import Api from "#lib/api";
import EventsHub from "#lib/events/hub1";
import SharedMutex from "#lib/threads/shared-mutex";

const RESERVED = new Set( ["connect", "disconnect"] );

export default class Cluster {
    #api;
    #id;
    #prefix;
    #sharedMutexesSet;
    #hub = new EventsHub();

    constructor ( id, api ) {
        this.#id = id;
        this.#api = Api.new( api, { "maxConnections": 1 } );
        this.#prefix = `cluster://${this.#id}`;

        this.#sharedMutexesSet = new SharedMutex.Set( this.#api, { "clusterId": id } );

        this.#hub.link( this.#api, {
            "on": name => {
                if ( RESERVED.has( name ) ) {
                    return name;
                }
                else {
                    return `${this.#prefix}/${name}`;
                }
            },
            "forwarder": ( name, ...args ) => {
                if ( RESERVED.has( name ) ) {
                    this.#hub.emit( name, ...args );
                }
                else {
                    this.#hub.emit( name, ...JSON.parse( ...args ) );
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

        var targets;

        if ( typeof name === "object" ) {
            ( { name, targets, "arguments": args } = name );
        }

        if ( name.endsWith( "/" ) ) {
            targets ??= args.shift();
            if ( !Array.isArray( targets ) ) targets = [targets];

            const msg = JSON.stringify( args );

            for ( const target of targets ) {

                // other cluster
                if ( name.startsWith( "//" ) ) {
                    this.#api.voidCall( "cluster/publish", `cluster:${name}${target}`, msg );
                }

                // own cluster
                else {
                    this.#api.voidCall( "cluster/publish", `${this.#prefix}/${name}${target}`, msg );
                }
            }
        }
        else {

            // other cluster
            if ( name.startsWith( "//" ) ) {
                this.#api.voidCall( "cluster/publish", `cluster:${name}`, JSON.stringify( args ) );
            }

            // own cluster
            else {
                this.#api.voidCall( "cluster/publish", `${this.#prefix}/${name}`, JSON.stringify( args ) );
            }
        }
    }
}
