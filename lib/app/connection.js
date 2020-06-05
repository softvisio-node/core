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

const { toMessagePack, fromMessagePack } = require( "./util" );

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

    async onOpen ( ws, req ) {
        ws.subscribe( "client/all" );
        ws.subscribe( "client/guests" );

        ws.auth = await this.#app.authenticate();
    }

    onClose ( ws, status, reason ) {

        // reason = Buffer.from( reason );
    }

    async onMessage ( ws, msg, isBinary ) {

        // try to decode json
        try {
            msg = isBinary ? fromMessagePack( Buffer.from( msg ) ) : JSON.parse( Buffer.from( msg ) );
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

            msg = { "type": "auth" };

            ws.send( isBinary ? toMessagePack( msg ) : JSON.stringify( msg ), isBinary );
        }

        // event
        else if ( msg.type === "event" ) {

            // events from client currently ignored
        }

        // rpc
        else if ( msg.type === "rpc" ) {

            // rpc request
            if ( msg.method ) {
                const id = msg.id,
                    auth = ws.auth;

                // void call
                if ( !id ) {
                    auth.call( msg.method, msg.args );
                }

                // regular call
                else {
                    const res = await auth.call( msg.method, msg.args );

                    msg = {
                        "type": "rpc",
                        "id": id,
                        "result": res,
                    };

                    ws.send( isBinary ? toMessagePack( msg ) : JSON.stringify( msg ), isBinary );
                }
            }
        }
    }
};
