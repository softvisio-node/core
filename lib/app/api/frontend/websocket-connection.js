import env from "#lib/env";
import uuid from "#lib/uuid";
import ServerWebSocketConnection from "#lib/http/server/websocket-connection";
import Context from "#lib/app/api/frontend/context";
import Events from "#lib/events";
import JsonContainer from "#lib/json-container";

const LOCAL_EVENTS = new Set( [

    //
    "connect",
    "disconnect",
] );

export default class WebSocketConnection extends ServerWebSocketConnection {
    #id = uuid();
    #ctx;
    #locale;
    #incomingEvents;
    #outgoingEvents;
    #publishRemoteIncomingEvent;
    #events;
    #abortControllers = {};
    #sessionStateEvents;

    constructor ( { server, ws, options, incomingEvents, outgoingEvents, publishRemoteIncomingEvent, sessionStateEvents } ) {
        super( server, ws, options );

        this.#incomingEvents = incomingEvents;
        this.#outgoingEvents = outgoingEvents;
        this.#publishRemoteIncomingEvent = publishRemoteIncomingEvent;

        this.#events = new Events().link( this.#outgoingEvents, {
            "on": this.#subscriber.bind( this ),
        } );

        const ctx = this.data.ctx;
        delete this.data.ctx;

        this.#locale = this.data.locale;
        delete this.data.locale;

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

        // update last activity timestamp
        this.#ctx.updateLastActivity();

        this.#incomingEvents.emit( "connect", this );

        if ( this.api.isApi && this.ctx.user.id ) {
            this.#sessionStateEvents = new Events().link( sessionStateEvents );

            // user disabled
            this.#sessionStateEvents.on( `user/disable/${ this.ctx.user.id }`, this.#onSessionDisable.bind( this ) );

            // user email updated
            this.#sessionStateEvents.on( `user/email-update/${ this.ctx.user.id }`, this.#onSessionReload.bind( this ) );

            // api token
            if ( this.ctx.token.isApiToken ) {

                // api token disabled
                this.#sessionStateEvents.on( `api-token/disable/${ this.ctx.token.id }`, this.#onSessionDisable.bind( this ) );

                // api token delete
                this.#sessionStateEvents.on( `api-token/delete/${ this.ctx.token.id }`, this.#onSessionDelete.bind( this ) );
            }

            // session token delete
            else if ( this.ctx.token.isSessionToken ) {
                this.#sessionStateEvents.on( `api-session/delete/${ this.ctx.token.id }`, this.#onSessionDelete.bind( this ) );
            }
        }
    }

    // static
    static get localEvents () {
        return LOCAL_EVENTS;
    }

    // properties
    get id () {
        return this.#id;
    }

    get app () {
        return this.#ctx.api.app;
    }

    get api () {
        return this.#ctx.api;
    }

    get ctx () {
        return this.#ctx;
    }

    get locale () {
        return this.#locale;
    }

    // public
    send ( msg ) {
        if ( !this.isConnected ) return;

        // locale
        if ( this.#locale ) {
            msg = new JsonContainer( msg, {
                "translation": {
                    "localeDomain": this.#locale,
                },
            } );
        }

        super.send( JSON.stringify( msg ), false );
    }

    // protected
    _onDisconnect ( res ) {
        this.#sessionStateEvents?.unlinkAll();

        // unsubscribe from all events
        this.#events.clear();

        super._onDisconnect( res );

        this.#incomingEvents.emit( "disconnect", this );
    }

    async _onMessage ( msg, isBinary ) {
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
            if ( !Array.isArray( msg.params ) ) msg.params = msg.params === undefined ? [] : [ msg.params ];

            // subscribe
            if ( msg.method === "/subscribe" ) {
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

            // abort
            else if ( msg.method === "/abort" ) {
                this.#abortControllers[ msg.id ]?.abort();

                delete this.#abortControllers[ msg.id ];
            }

            // rpc
            else {

                // regular call
                if ( msg.id ) {
                    const signal = ( this.#abortControllers[ msg.id ] = new AbortController() ).signal;

                    const res = await this.#ctx.call( {
                        "method": msg.method,
                        "arguments": msg.params,
                        signal,
                    } );

                    delete this.#abortControllers[ msg.id ];

                    if ( !signal.aborted ) this.send( res.toJsonRpc( msg.id ) );
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

            if ( !this.api.schema.isEventValid( name ) ) {
                if ( env.isDevelopment ) console.log( `ERROR: ignore unregistered event "${ name }"` );

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
            names.push( `${ name }/all` );

            if ( ctx.isAuthenticated ) {
                names.push( `${ name }/users` );
                names.push( `${ name }/${ ctx.user.id }` );

                if ( ctx.user.isRoot ) names.push( `${ name }/root` );
            }
            else {
                names.push( `${ name }/guests` );
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

        if ( this.#locale ) {
            cache[ this.#locale ] ??= JSON.stringify( new JsonContainer(
                {
                    "jsonrpc": "2.0",
                    "method": "/publish",
                    "params": [ name, ...args ],
                },
                {
                    "translation": {
                        "localeDomain": this.#locale,
                    },
                }
            ) );

            super.send( cache[ this.#locale ], false );
        }
        else {
            cache.noLocale ??= JSON.stringify( {
                "jsonrpc": "2.0",
                "method": "/publish",
                "params": [ name, ...args ],
            } );

            super.send( cache.noLocale, false );
        }
    }

    #onSessionDisable () {
        const msg = JSON.stringify( {
            "jsonrpc": "2.0",
            "method": "/publish",
            "params": [ "sessionDisable" ],
        } );

        super.send( msg );
    }

    #onSessionDelete () {
        const msg = JSON.stringify( {
            "jsonrpc": "2.0",
            "method": "/publish",
            "params": [ "sessionDelete" ],
        } );

        super.send( msg );
    }

    #onSessionReload () {
        const msg = JSON.stringify( {
            "jsonrpc": "2.0",
            "method": "/publish",
            "params": [ "sessionReload" ],
        } );

        super.send( msg );
    }
}
