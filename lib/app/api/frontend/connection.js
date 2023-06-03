import env from "#lib/env";
import uuidV4 from "#lib/uuid";
import ServerConnection from "#lib/http/server/connection";
import Context from "#lib/app/api/frontend/context";
import Events from "#lib/events";

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
    #events;

    constructor ( { server, ws, options, incomingEvents, outgoingEvents, publishRemoteIncomingEvent } ) {
        super( server, ws, options );

        this.#incomingEvents = incomingEvents;
        this.#outgoingEvents = outgoingEvents;
        this.#publishRemoteIncomingEvent = publishRemoteIncomingEvent;

        this.#events = new Events().link( this.#outgoingEvents, {
            "on": this.#subscriber.bind( this ),
        } );

        const ctx = this.data.ctx;
        delete this.data.ctx;

        // clone context
        this.#ctx = new Context( ctx.api, {
            "token": ctx.token,
            "user": ctx.user,
            "isDeleted": ctx.isDeleted,
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

        this.#incomingEvents.emit( "connect", this );
    }

    onDisconnect ( res ) {

        // unsubscribe from all events
        this.#events.clear();

        super.onDisconnect( res );

        this.#incomingEvents.emit( "disconnect", this );
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
                    const res = await this.api.health.healthCheck();

                    this.send( res.toJsonRpc( msg.id ) );
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

                    this.send( res.toJsonRpc( msg.id ) );
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

        // context is deleted
        if ( ctx.isDeleted ) return;

        for ( const name of names ) {

            // already subscribed
            if ( this.#events.listenerCount( name ) ) continue;

            // event name is reserved
            if ( LOCAL_EVENTS.has( name ) ) continue;

            if ( !this.api.schema.allowAllEvents && !this.api.schema.emits.has( name ) ) {
                if ( env.isDevelopment ) console.log( `ERROR: ignore unregistered event "${name}"` );

                continue;
            }

            // subscribe to the user events
            this.#events.on( name, this.#publishEvent.bind( this, name ) );
        }
    }

    #onUnsubscribe ( names ) {
        if ( !names || !Array.isArray( names ) ) return;

        for ( const name of names ) this.#events.offAll( name );
    }

    #subscriber ( name ) {
        const ctx = this.ctx,
            names = [];

        if ( this.api.isRpc ) {
            names.push( name );
        }
        else {
            names.push( `${name}/*` );

            if ( ctx.isAuthenticated ) {
                names.push( `${name}/user` );
                names.push( `${name}/${ctx.user.id}` );

                if ( ctx.user.isRoot ) names.push( `${name}/root` );
            }
            else {
                names.push( `${name}/guest` );
            }
        }

        return names;
    }

    async #publishEvent ( name, args, cache, publisherId ) {

        // connection closed
        if ( !this.isConnected ) return;

        if ( publisherId === this.#id ) return;

        const ctx = this.#ctx;

        // context is deleted
        if ( ctx.isDeleted ) return;

        // update context
        if ( ctx.token.id ) {

            // update context
            await ctx.update();

            // context is deleted or disabled
            if ( ctx.isDeleted || !ctx.isEnabled ) return;
        }

        cache.msg ??= JSON.stringify( {
            "jsonrpc": "2.0",
            "method": "/publish",
            "params": [name, ...args],
        } );

        super.send( cache.msg, false );
    }
}
