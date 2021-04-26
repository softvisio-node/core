require( "#index" );

const Common = require( "#lib/api/client/common" );

const WebSocket = require( "ws" );
const fetch = require( "#lib/http/fetch" );
const crypto = require( "crypto" );
const fs = require( "./fs" );
const path = require( "path" );
const mime = require( "./db/mime" );

module.exports = class extends Common {

    // websocket
    // https://github.com/websockets/ws/blob/master/doc/ws.md#new-websocketaddress-protocols-options
    get _WebSocket () {
        return WebSocket;
    }

    // http
    get _fetch () {
        return fetch;
    }

    // upload
    uploadGetFileName ( file ) {
        return path.basename( file );
    }

    async uploadGetFileStats ( file ) {
        var stat = await fs.promises.stat( file );

        if ( !stat.isFile() ) {
            throw "Upload is not a file";
        }
        else {
            const mimeType = mime.getByFilename( file );

            return {
                "size": stat.size,
                "type": mimeType ? mimeType["content-type"] : null,
            };
        }
    }

    async uploadOpenFile ( file ) {
        return fs.promises.open( file, "r" );
    }

    uploadCloseFile ( fh ) {
        fh.close();
    }

    async uploadCreateHashObject () {
        return crypto.createHash( "SHA1" );
    }

    async uploadReadFileChunk ( fh, offset, length ) {
        const buf = Buffer.allocUnsafe( length ),
            res = await fh.read( buf, 0, length, offset );

        if ( res.bytesRead < length ) {
            return buf.slice( 0, res.bytesRead );
        }
        else {
            return buf;
        }
    }

    uploadChunk ( method, id, offset, chunk ) {
        return this.call( method, {
            id,
            offset,
            "chunk": chunk.buffer.slice( chunk.byteOffset, chunk.byteOffset + chunk.byteLength ),
        } );
    }
};
