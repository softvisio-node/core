const { mixin } = require( "./mixins" );
const cli = require( "./cli" );
const Server = require( "./server" );

module.exports = mixin( ( Super ) =>
    class extends Super {
            devel = false;
            server = null;

            static runCli () {
                cli( this.cli() );
            }

            static cli () {
                var spec = super.cli ? super.cli() : {};

                spec.options.devel = {
                    "summary": "run app in development mode",
                    "default": false,
                    "schema": {
                        "type": "boolean",
                    },
                };

                return spec;
            }

            constructor ( options ) {
                if ( !options ) options = {};

                super( options );

                if ( process.cli ) {
                    if ( process.cli.options.devel ) this.devel = process.cli.options.devel;

                    if ( options.devel ) this.devel = options.devel;
                }
            }

            run () {
                this.server = new Server( {} );

                super.run();

                this.server.listen( "0.0.0.0", 80, ( socket ) => {
                    console.log( "Listening ..." );
                } );
            }

            // AUTHENTICATION
            async authenticate ( token ) {
                return res( 200, {
                    "user_id": 199,
                    "user_name": "root",
                    "groups": ["admin", "user"],
                } );
            }

            // CONNECTION
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
                        const auth = ws.auth,
                            res = await auth.call( msg.method, msg.args );

                        ws.send( JSON.stringify( {
                            "type": "rpc",
                            "tid": msg.tid,
                            "result": res,
                        } ) );
                    }
                }
            }
    } );
// -----SOURCE FILTER LOG BEGIN-----
//
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
// | Sev.  | Line:Col      | Rule                         | Description                                                                    |
// |=======+===============+==============================+================================================================================|
// | ERROR | 52:24         | no-undef                     | 'res' is not defined.                                                          |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 93:27         | no-unused-vars               | 'ok' is assigned a value but never used.                                       |
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
//
// -----SOURCE FILTER LOG END-----
