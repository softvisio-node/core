const defineMixin = require( "../../mixins" );
const ApiBase = require( "./base" );
const Upload = require( "./browser/upload" );

const Transport = defineMixin( ( SuperClass ) =>
    class extends SuperClass {
            #url = null;

            #ws = null;

            setUrl ( url ) {
                const a = document.createElement( "a" );

                a.href = url || "/api";

                url = new URL( a.href );

                if ( url.protocol !== "ws:" && url.protocol !== "wss:" ) {
                    if ( url.protocol === "https:" ) {
                        url.protocol = "wss:";
                    }
                    else {
                        url.protocol = "ws:";
                    }
                }

                if ( url.username ) {
                    this.setToken( url.username );

                    url.username = "";
                    url.password = "";
                }

                this.#url = url.toString();
            }

            // method, file, args?, cb?
            async upload () {
                const method = arguments[0],
                    file = arguments[1];

                let args, onProgress;

                // parse arguments
                if ( arguments[2] ) {
                    if ( typeof arguments[2] === "function" ) {
                        onProgress = arguments[2];
                    }
                    else {
                        args = arguments[2];
                        onProgress = arguments[3];
                    }
                }

                const upload = new Upload( file, onProgress );

                await upload._start( this, method, args );

                return upload;
            }

            _getWs () {
                return this.#ws;
            }

            _connect () {
                this.#ws = new WebSocket( this.#url, "softvisio" );

                this.#ws.binaryType = "blob";

                this.#ws.onopen = this._onOpen.bind( this );

                this.#ws.onerror = this._onError.bind( this );

                this.#ws.onclose = this._onClose.bind( this );

                this.#ws.onmessage = ( e ) => {
                    this._onMessage( e.data );
                };
            }

            _send ( data ) {
                this.#ws.send( data );
            }

            _close ( status, reason ) {
                if ( this.#ws ) {
                    this.#ws.close( status, reason );

                    this.#ws = null;
                }
            }
    } );

module.exports = class extends mix( ApiBase, Transport ) {};
// -----SOURCE FILTER LOG BEGIN-----
//
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
// | Sev.  | Line:Col      | Rule                         | Description                                                                    |
// |=======+===============+==============================+================================================================================|
// | ERROR | 95:32         | no-undef                     | 'mix' is not defined.                                                          |
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
//
// -----SOURCE FILTER LOG END-----
