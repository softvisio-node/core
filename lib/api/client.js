const { mix } = require( "../mixins" );
const WebSocket = require( "ws" );
const ApiBase = require( "./client/base" );
const EventEmitter = require( "events" );
const crypto = require( "crypto" );
const fs = require( "../fs" );
const path = require( "path" );
const getMime = require( "../mime" );

class NodeApiClient extends EventEmitter {
    setUrl ( url ) {
        url = new URL( url );

        if ( url.username ) {
            this.setToken( url.username );

            url.username = "";
            url.password = "";
        }

        return url;
    }

    _createConnection ( url ) {

        // https://github.com/websockets/ws/blob/master/doc/ws.md#new-websocketaddress-protocols-options
        const ws = new WebSocket( url, "softvisio", {} );

        ws.on( "error", this._onError.bind( this ) );

        ws.on( "open", this._onOpen.bind( this ) );

        ws.on( "close", this._onClose.bind( this ) );

        ws.on( "message", this._onMessage.bind( this ) );

        return ws;
    }

    // UPLOAD
    async uploadGetFileParams ( file ) {
        try {
            var stat = await fs.promises.stat( file );
        }
        catch ( e ) {
            return;
        }

        if ( !stat || !stat.isFile() ) {
            return;
        }
        else {
            const mime = getMime( file );

            return {
                "name": path.basename( file ),
                "size": stat.size,
                "type": mime ? mime.type : null,
            };
        }
    }

    async uploadOpenFile ( file ) {
        return fs.promises.open( file, "r" );
    }

    async uploadCreateHashObject () {
        return crypto.createHash( "SHA1" );
    }

    async uploadReadFileChunk ( fh, offset, length ) {
        const buf = Buffer.allocUnsafe( length ),
            res = await fh.read( buf, 0, length, offset );

        if ( !res.bytesRead ) {
            return;
        }
        else if ( res.bytesRead < length ) {
            return buf.slice( 0, res.bytesRead );
        }
        else {
            return buf;
        }
    }
}

module.exports = class extends mix( ApiBase, NodeApiClient ) {};
