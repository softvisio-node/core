const { mixin, mix } = require( "../mixins" );
const WebSocket = require( "ws" );
const ApiBase = require( "./client/base" );
const WEBSOCKET_READYSTATE_OPEN = 1;

const Transport = mixin( ( Super ) =>
    class extends Super {
            #url = null;

            #ws = null;

            setUrl ( url ) {
                this.#url = url;

                this._close();
            }

            // TODO
            async upload () {}

            _getWs () {
                return this.#ws;
            }

            _connect () {
                // do nothing if connection is already created
                if ( this.#ws ) return;

                // https://github.com/websockets/ws/blob/master/doc/ws.md#new-websocketaddress-protocols-options
                this.#ws = new WebSocket( this.#url, "softvisio", {} );

                this.#ws.on( "error", this._onError.bind( this ) );

                this.#ws.on( "open", this._onOpen.bind( this ) );

                this.#ws.on( "close", this._onClose.bind( this ) );

                this.#ws.on( "message", this._onMessage.bind( this ) );
            }

            _onClose () {
                this.#ws = null;
            }

            _send ( data ) {
                if ( this.#ws.readyState === WEBSOCKET_READYSTATE_OPEN ) {
                    this.#ws.send( data );
                }
            }

            _close () {
                if ( this.#ws ) {
                    this.#ws.close( 1000, "Normal Closure" );
                }
            }
    } );

module.exports = class extends mix( ApiBase, Transport ) {};
