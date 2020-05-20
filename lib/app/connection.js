/* EVENTS:
 *
 * clients/all - to all connected clients
 * clients/guests - to guests users
 * clients/users/all - to all authenticated clients
 * clients/users/<id> - to specific user
 * clients/users/root - to root users
 * clients/groups/<name> - to users group
 *
 */

module.exports = class {
    #app = null;

    constructor ( app ) {
        this.#app = app;
    }

    getServerConfig () {
        return {
            "open": this.onOpen.bind( this ),
            "close": this.onClose.bind( this ),
            "message": this.onMessage.bind( this ),
        };
    }

    onOpen ( ws, req ) {
        ws.subscribe( "clients/all" );
        ws.subscribe( "clients/guests" );
    }

    onClose ( ws, status, reason ) {
        reason = Buffer.from( reason );
    }

    // TODO finish subscriptions
    async onMessage ( ws, msg, isBinary ) {
        // binary messages are ignored
        if ( isBinary ) return;

        // try to decode json
        try {
            msg = JSON.parse( Buffer.from( msg ) );
        }
        catch ( e ) {
            return;
        }

        // auth
        if ( msg.type === "auth" ) {
            var auth = await this.#app.authenticate( msg.token );

            ws.auth = auth;

            ws.unsubscribeAll();

            if ( auth.isAuthenticated ) {
                ws.subscribe( "clients/all" );
                ws.subscribe( "clients/users/all" );
                ws.subscribe( "clients/users/" + auth.userId );

                if ( auth.isRoot() ) ws.subscribe( "clients/users/root" );

                for ( const group of auth.groups ) {
                    ws.subscribe( "clients/groups/" + group );
                }
            }
            else {
                ws.subscribe( "clients/all" );
                ws.subscribe( "clients/guests" );
            }

            ws.send( JSON.stringify( { "type": "auth" } ), false );
        }

        // event
        else if ( msg.type === "event" ) {
            // events from client currently ignored
        }

        // rpc
        else if ( msg.type === "rpc" ) {
            // rpc request
            if ( msg.method ) {
                const auth = ws.auth,
                    res = await auth.call( msg.method, msg.args );

                ws.send( JSON.stringify( {
                    "type": "rpc",
                    "id": msg.id,
                    "result": res,
                } ) );
            }
        }
    }
};
