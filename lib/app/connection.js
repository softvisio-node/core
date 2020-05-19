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

    onOpen ( ws, req ) {}

    onClose ( ws, status, reason ) {
        reason = Buffer.from( reason );

        console.log( "WebSocket closed: " + status + " " + reason );
    }

    async onMessage ( ws, msg, isBinary ) {
        if ( isBinary ) return;

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

            // TODO subscribe authentiicated / not-authenticated users
            if ( auth.is_authenticated ) {
                ws.subscribe( "users" );
                ws.subscribe( "user/" + auth.user_id );
                for ( const group of auth.groups ) {
                    ws.subscribe( "group/" + group );
                }
            }

            ws.send( JSON.stringify( { "type": "auth" } ), false );
        }

        // event
        else if ( msg.type === "event" ) {
            console.log( msg );
        }

        // rpc
        else if ( msg.type === "rpc" ) {
            console.log( msg );

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
