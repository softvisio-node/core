import env from "#lib/env";
import uuidV4 from "#lib/uuid";
import ServerConnection from "#lib/http/server/connection";
import Context from "#lib/app/api/frontend/context";

const LOCAL_EVENTS = new Set( [

    //
    "connect",
    "disconnect",
] );

export default class Connection extends ServerConnection {
    #id = uuidV4();
    #ctx;
    #incomingEvents;
    #outgoingEvents;
    #publishRemoteIncomingEvent;
    #subscribedEvents = new Map();

    constructor ( { server, ws, options, incomingEvents, outgoingEvents, publishRemoteIncomingEvent } ) {
        super( server, ws, options );

        this.#incomingEvents = incomingEvents;
        this.#outgoingEvents = outgoingEvents;
        this.#publishRemoteIncomingEvent = publishRemoteIncomingEvent;

        const ctx = this.data.ctx;
        delete this.data.ctx;

        // clone context
        this.#ctx = new Context( ctx.api, {
            "token": ctx.token,
            "user": ctx.user,
            "connection": this,
            "hostname": ctx.hostname,
            "userAgent": ctx.userAgent,
            "remoteAddress": ctx.remoteAddress,
        } );
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
        return this.#ctx.api;
    }

    get ctx () {
        return this.#ctx;
    }

    // public
    send ( msg ) {
        if ( !this.isConnected ) return;

        super.send( JSON.stringify( msg ), false );
    }

    onConnect () {
        super.onConnect();

        // update last activity timestamp
        this.#ctx.updateLastActivity();

        this.#incomingEvents.publish( "connect", this );
    }

    onDisconnect ( res ) {

        // unsubscribe from all events
        for ( const name of this.#subscribedEvents.keys() ) this.#unsubscribe( name );

        super.onDisconnect( res );

        this.#incomingEvents.publish( "disconnect", this );
    }

    async onMessage ( msg, isBinary ) {
        if ( isBinary ) return;

        // update last activity timestamp
        this.#ctx.updateLastActivity();

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
                if ( msg.id ) {
                    const res = await this.api.healthCheck.check();

                    this.send( res.toRpc( msg.id ) );
                }
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
                this.#publishRemoteIncomingEvent( this.#ctx, msg.params );
            }

            // rpc
            else {

                // regular call
                if ( msg.id ) {
                    const res = await this.#ctx.call( msg.method, ...msg.params );

                    this.send( res.toRpc( msg.id ) );
                }

                // void call
                else {
                    this.#ctx.voidCall( msg.method, ...msg.params );
                }
            }
        }
    }

    // private
    #onSubscribe ( names ) {
        if ( !names || !Array.isArray( names ) ) return;

        const ctx = this.ctx;

        for ( const name of names ) {

            // already subscribed
            if ( this.#subscribedEvents.has( name ) ) continue;

            // event name is reserved
            if ( LOCAL_EVENTS.has( name ) ) continue;

            if ( !this.api.frontend.schema.allowAllEvents && !this.api.frontend.schema.emits.has( name ) ) {
                if ( env.isDevelopment ) console.log( `ERROR: ignore unregistered event "${name}"` );

                continue;
            }

            const listener = this.#eventsListener.bind( this, name ),
                listeners = [];

            this.#subscribedEvents.set( name, listeners );

            // subscribe to the user events
            if ( this.api.isRpc ) {
                listeners.push( [name, listener] );
            }
            else {
                listeners.push( [`${name}/*`, listener] );

                if ( ctx.isAuthenticated ) {
                    listeners.push( [`${name}/user`, listener] );

                    if ( ctx.user.isRoot ) listeners.push( [`${name}/root`, listener] );

                    listeners.push( [`${name}/${ctx.user.id}`, listener] );
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

    // XXX update context
    #eventsListener ( name, args, cache, publisherId ) {

        // connection closed
        if ( !this.isConnected ) return;

        // api backend is down or user was deleted
        // if ( !( await this.#ctx.update() ) ) return;

        if ( !this.#ctx.isEnabled ) return;

        if ( publisherId === this.#id ) return;

        cache.msg ??= JSON.stringify( {
            "jsonrpc": "2.0",
            "method": "/publish",
            "params": [name, ...args],
        } );

        super.send( cache.msg, false );
    }
}
