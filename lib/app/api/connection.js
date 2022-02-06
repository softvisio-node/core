import msgpack from "#lib/msgpack";
import env from "#lib/env";
import * as uuid from "#lib/uuid";
import _Connection from "#lib/http/server/connection";

const LOCAL_EVENTS = new Set( [

    //
    "connect",
    "disconnect",
    "backend/connect",
    "backend/disconnect",
] );

export default class Connection extends _Connection {
    #id = uuid.v4();
    #api;
    #in;
    #out;
    #publishRemoteIncomingEvent;
    #call;
    #subscribedEvents = new Map();

    constructor ( ws, options, api, _in, out, publishRemoteIncomingEvent, call ) {
        super( ws, options );

        this.#api = api;
        this.#in = _in;
        this.#out = out;
        this.#publishRemoteIncomingEvent = publishRemoteIncomingEvent;
        this.#call = call;
    }

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

    // protected
    _onDisconnect ( res ) {

        // unsubscribe from all events
        for ( const name of this.#subscribedEvents.keys() ) this.#unsubscribe( name );

        this.#in.publish( "disconnect", this );

        super._onDisconnect( res );
    }

    async _onMessage ( msg, isBinary ) {

        // update auth last activity timestamp
        if ( this.#api.authCache ) this.#api.authCache.updateAuthLastActivity( this.auth );

        // try to decode message
        try {
            msg = isBinary ? msgpack.decode( msg ) : JSON.parse( Buffer.from( msg ) );
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
                if ( msg.id ) this.send( { "jsonrpc": "2.0", "id": msg.id, "method": "/pong" }, isBinary );
            }

            // pong
            else if ( msg.method === "/pong" ) {
                return;
            }

            // healthcheck
            else if ( msg.method === "/healthcheck" ) {
                const res = await this.#api.healthCheck();

                if ( msg.id ) this.send( res.toRpc( msg.id ), isBinary );
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
                    if ( msg.id ) this.send( result( -32900 ).toRpc( msg.id ), isBinary );
                }

                // binary protocol is required
                else if ( method?.binaryProtocolRequired && !isBinary ) {
                    if ( msg.id ) this.send( result( -32811 ).toRpc( msg.id ), isBinary );
                }

                // regular call
                else if ( msg.id ) {
                    const res = await this.#call( this.auth, msg.method, msg.params, false, this );

                    this.send( res.toRpc( msg.id ), isBinary );
                }

                // void call
                else {
                    this.#call( this.auth, msg.method, msg.params, true, this );
                }
            }
        }
    }

    send ( msg, isBinary ) {
        if ( !this.isConnected ) return;

        if ( isBinary ) {
            super.send( msgpack.encode( msg ), true );
        }
        else {
            super.send( JSON.stringify( msg ), false );
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

                    if ( auth.isRoot ) listeners.push( [`${name}/root`, listener] );

                    listeners.push( [`${name}/${auth.userId}`, listener] );

                    for ( const [permission, enabled] of Object.entries( auth.permissions ) ) {
                        if ( enabled ) listeners.push( [`${name}/${permission}`, listener] );
                    }
                }
                else {
                    listeners.push( [`${name}/guest`, listener] );
                }
            }

            listeners.forEach( args => this.#out.on( ...args ) );
        }
    }

    #onUnsubscribe ( names ) {
        if ( !names || !Array.isArray( names ) ) return;

        for ( const name of names ) this.#unsubscribe( name );
    }

    #unsubscribe ( name ) {
        const listeners = this.#subscribedEvents.get( name );

        if ( !listeners ) return;

        listeners.forEach( args => this.#out.off( ...args ) );

        this.#subscribedEvents.delete( name );
    }

    #eventsListener ( name, args, cache, publisherId ) {
        if ( !this.isConnected ) return;

        if ( publisherId === this.#id ) return;

        cache.msg ??= {
            "jsonrpc": "2.0",
            "method": "/publish",
            "params": [name, ...args],
        };

        if ( this.isBinary ) {
            super.send( ( cache.binary ||= msgpack.encode( cache.msg ) ), true );
        }
        else {
            super.send( ( cache.text ||= JSON.stringify( cache.msg ) ), false );
        }
    }
}
