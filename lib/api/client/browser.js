const defineMixin = require( "../mixins" );
const ApiBase = require( "./client/base" );
const Upload = require( "./browser/upload" );

const Transport = defineMixin( ( SuperClass ) =>
    class extends SuperClass {
            #url = null;

            #ws = null;

            setUrl ( url ) {
                this.#url = url;

                if ( this.#ws ) this.#ws.terminate();
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

                this.#ws.onmessage = this._onMessage.bind( this );
            }

            _send ( data ) {
                this.#ws.send( data );
            }

            _terminate ( status, reason ) {
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
// | ERROR | 73:32         | no-undef                     | 'mix' is not defined.                                                          |
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
//
// -----SOURCE FILTER LOG END-----
