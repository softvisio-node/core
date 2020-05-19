const { mixin, mix } = require( "../mixins" );
const WebSocket = require( "ws" );
const ApiBase = require( "./client/base" );

const Transport = mixin( ( Super ) =>
    class extends Super {
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
                // https://github.com/websockets/ws/blob/master/doc/ws.md#new-websocketaddress-protocols-options
                this.#ws = new WebSocket( this.#url, "softvisio", {} );

                this.#ws.on( "error", this._onError.bind( this ) );

                this.#ws.on( "open", this._onOpen.bind( this ) );

                this.#ws.on( "close", this._onClose.bind( this ) );

                this.#ws.on( "message", this._onMessage.bind( this ) );
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
