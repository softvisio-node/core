import env from "#lib/env";
import uuidV4 from "#lib/uuid";
import ServerConnection from "#lib/http/server/connection";

const LOCAL_EVENTS = new Set( [

    //
    "connect",
    "disconnect",
    "backend/connect",
    "backend/disconnect",
] );

export default class Connection extends ServerConnection {
    #id = uuidV4();
    #api;
    #incomingEvents;
    #outgoingEvents;
    #publishRemoteIncomingEvent;
    #call;
    #subscribedEvents = new Map();

    constructor ( server, ws, options, api, incomingEvents, outgoingEvents, publishRemoteIncomingEvent, call ) {
        super( server, ws, options );

        this.#api = api;
        this.#incomingEvents = incomingEvents;
        this.#outgoingEvents = outgoingEvents;
        this.#publishRemoteIncomingEvent = publishRemoteIncomingEvent;
        this.#call = call;
    }

    // static
    static get localEvents () {
        return LOCAL_EVENTS;
    }

    // properties
    get id () {
        return this.#id;
    }

    get api () {
        return this.#api;
    }

    get auth () {
        return this.data.auth;
    }

    // public
    send ( msg ) {
        if ( !this.isConnected ) return;

        super.send( JSON.stringify( msg ), false );
    }

    // protected
    _onDisconnect ( res ) {

        // unsubscribe from all events
        for ( const name of this.#subscribedEvents.keys() ) this.#unsubscribe( name );

        this.#incomingEvents.publish( "disconnect", this );

        super._onDisconnect( res );
    }

    async _onMessage ( msg, isBinary ) {
        if ( isBinary ) return;

        // update auth last activity timestamp
        if ( this.#api.authCache ) this.#api.authCache.updateAuthLastActivity( this.auth );

        // try to decode message
        try {
            msg = JSON.parse( Buffer.from( msg ) );
        }
        catch ( e ) {
            return;
        }

        // request
        if ( msg.method ) {
            if ( !Array.isArray( msg.params ) ) msg.params = msg.params === undefined ? [] : [msg.params];

            // ping
            if ( msg.method === "/ping" ) {

                // response with pong, if required
                if ( msg.id ) this.send( { "jsonrpc": "2.0", "id": msg.id, "method": "/pong" } );
            }

            // pong
            else if ( msg.method === "/pong" ) {
                return;
            }

            // healthcheck
            else if ( msg.method === "/healthcheck" ) {
                const res = await this.#api.healthCheck();

                if ( msg.id ) this.send( res.toRpc( msg.id ) );
            }

            // subscribe
            else if ( msg.method === "/subscribe" ) {
                this.#onSubscribe( ...msg.params );
            }

            // unsubscribe
            else if ( msg.method === "/unsubscribe" ) {
                this.#onUnsubscribe( ...msg.params );
            }

            // publish
            else if ( msg.method === "/publish" ) {
                this.#publishRemoteIncomingEvent( this.auth, msg.params );
            }

            // rpc
            else {
                const method = this.#api.schema.methods[msg.method];

                // upload method, invalid usage
                if ( method?.isUpload ) {
                    if ( msg.id ) this.send( result( -32900 ).toRpc( msg.id ) );
                }

                // regular call
                else if ( msg.id ) {
                    const res = await this.#call( this.auth, msg.method, msg.params, {
                        "isVoid": false,
                        "connection": this,
                        "hostname": this.data.hostname,
                        "userAgent": this.data.userAgent,
                        "remoteAddress": this.data.remoteAddress,
                    } );

                    this.send( res.toRpc( msg.id ) );
                }

                // void call
                else {
                    this.#call( this.auth, msg.method, msg.params, {
                        "isVoid": true,
                        "connection": this,
                        "hostname": this.data.hostname,
                        "userAgent": this.data.userAgent,
                        "remoteAddress": this.data.remoteAddress,
                    } );
                }
            }
        }
    }

    // private
    #onSubscribe ( names ) {
        if ( !names || !Array.isArray( names ) ) return;

        const auth = this.auth;

        for ( const name of names ) {

            // already subscribed
            if ( this.#subscribedEvents.has( name ) ) continue;

            // event name is reserved
            if ( LOCAL_EVENTS.has( name ) ) continue;

            if ( !this.#api.schema.allowAllevents && !this.#api.schema.emits.has( name ) ) {
                if ( env.isDevelopment ) console.log( `ERROR: ignore unregistered event "${name}"` );

                continue;
            }

            const listener = this.#eventsListener.bind( this, name ),
                listeners = [];

            this.#subscribedEvents.set( name, listeners );

            // subscribe to the user events
            if ( this.#api.isRpc ) {
                listeners.push( [name, listener] );
            }
            else {
                listeners.push( [`${name}/*`, listener] );

                if ( auth.isAuthenticated ) {
                    listeners.push( [`${name}/user`, listener] );

                    if ( auth.user.isRoot ) listeners.push( [`${name}/root`, listener] );

                    listeners.push( [`${name}/${auth.user.id}`, listener] );

                    for ( const role of auth.user.roles ) {
                        listeners.push( [`${name}/${role}`, listener] );
                    }
                }
                else {
                    listeners.push( [`${name}/guest`, listener] );
                }
            }

            listeners.forEach( args => this.#outgoingEvents.on( ...args ) );
        }
    }

    #onUnsubscribe ( names ) {
        if ( !names || !Array.isArray( names ) ) return;

        for ( const name of names ) this.#unsubscribe( name );
    }

    #unsubscribe ( name ) {
        const listeners = this.#subscribedEvents.get( name );

        if ( !listeners ) return;

        listeners.forEach( args => this.#outgoingEvents.off( ...args ) );

        this.#subscribedEvents.delete( name );
    }

    #eventsListener ( name, args, cache, publisherId ) {
        if ( !this.isConnected ) return;

        if ( publisherId === this.#id ) return;

        cache.msg ??= JSON.stringify( {
            "jsonrpc": "2.0",
            "method": "/publish",
            "params": [name, ...args],
        } );

        super.send( cache.msg, false );
    }
}
