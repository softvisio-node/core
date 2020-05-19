const { mixin } = require( "../mixins" );

module.exports = mixin( ( Super ) =>
    class extends Super {
        onConnect ( ws, req ) {}

        onDisconnect ( ws, status, reason ) {
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
                var auth = await this.authenticate( msg.token );

                ws.auth = auth;

                console.log( auth );

                // TODO subscribe authentiicated / not-authenticated users
                if ( auth ) {
                    ws.subscribe( "users" );
                    ws.subscribe( "user/" + auth.data.user_id );
                    for ( const group of auth.data.groups ) {
                        ws.subscribe( "group/" + group );
                    }
                }

                const ok = ws.send( JSON.stringify( { "type": "auth" } ), false );
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
                    const auth = ws.auth;
                    // res = await auth.call( msg.method, msg.args );

                    // ws.send( JSON.stringify( {
                    //     "type": "rpc",
                    //     "tid": msg.tid,
                    //     "result": res,
                    // } ) );
                }
            }
        }
    } );
// -----SOURCE FILTER LOG BEGIN-----
//
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
// | Sev.  | Line:Col      | Rule                         | Description                                                                    |
// |=======+===============+==============================+================================================================================|
// | ERROR | 38:23         | no-unused-vars               | 'ok' is assigned a value but never used.                                       |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 52:27         | no-unused-vars               | 'auth' is assigned a value but never used.                                     |
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
//
// -----SOURCE FILTER LOG END-----
