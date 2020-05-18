const defineMixin = require( "../mixins" );
const WebSocket = require( "ws" );
const ApiBase = require( "./client/base" );

const Transport = defineMixin( ( SuperClass ) =>
    class extends SuperClass {
            #url = null;

            #ws = null;

            setUrl ( url ) {
                this.#url = url;

                if ( this.#ws ) this.#ws.terminate();
            }

            // TODO
            async upload () {}

            _getWs () {
                return this.#ws;
            }

            _connect () {
                this.#ws = new WebSocket( this.#url );

                this.#ws.on( "error", this._onError.bind( this ) );

                this.#ws.on( "open", this._onOpen.bind( this ) );

                this.#ws.on( "close", this._onClose.bind( this ) );

                this.#ws.on( "message", this._onMessage.bind( this ) );
            }

            _send ( data ) {
                this.#ws.send( data );
            }

            _terminate ( status, reason ) {
                if ( this.#ws ) {
                    this.#ws.terminate( status, reason );

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
// | ERROR | 49:32         | no-undef                     | 'mix' is not defined.                                                          |
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
//
// -----SOURCE FILTER LOG END-----
