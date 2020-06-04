/* EVENTS:
 *
 * client/all - to all connected clients
 * client/guests - to guests users
 * client/users/all - to all authenticated clients
 * client/users/<id> - to specific user
 * client/users/root - to root users
 * client/groups/<name> - to users group
 *
 */

module.exports = class {
    #app;

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
        ws.subscribe( "client/all" );
        ws.subscribe( "client/guests" );
    }

    onClose ( ws, status, reason ) {

        // reason = Buffer.from( reason );
    }

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
                ws.subscribe( "client/all" );
                ws.subscribe( "client/users/all" );
                ws.subscribe( "client/users/" + auth.userId );

                if ( auth.isRoot() ) ws.subscribe( "client/users/root" );

                for ( const group of auth.groups ) {
                    ws.subscribe( "client/groups/" + group );
                }
            }
            else {
                ws.subscribe( "client/all" );
                ws.subscribe( "client/guests" );
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
