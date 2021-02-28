require( "@softvisio/core" );
const result = require( "../../result" );

const STATUS = {
    "STARTING": "Starting",
    "HASH": "Calculating hash",
    "UPLOADING": "Uploading",
    "DONE": "Done",
    "CANCELLED": "Cancelled",
};

var id = 0;

module.exports = class Upload {
    #api;
    #fh;
    #isStarted = false;
    #isFinished = false;
    #onProgress;

    id = ++id;
    name;
    size;
    type;

    // result
    ok;
    status;
    reason;
    progress = 0;
    data;

    cancel () {
        this._finish( result( [400, STATUS.CANCELLED] ) );
    }

    toString () {
        return this.reason;
    }

    // PRIVATE METHODS
    async start ( api, method, args, file, onProgress ) {
        if ( this.#isStarted ) return;

        this.#isStarted = true;
        this.#api = api;
        this.#onProgress = onProgress;

        this.name = api.uploadGetFileName( file );

        // operation is finished
        if ( this._setProgress( STATUS.STARTING, 0 ) ) return;

        // get file stats
        try {
            const stats = await api.uploadGetFileStats( file );

            this.size = stats.size;
            this.type = stats.type;
        }
        catch ( e ) {
            return this._finish( result( [500, e.message] ) );
        }

        // operation cancelled
        if ( this.#isFinished ) return;

        var res = await api.call( method, {
            "name": this.name,
            "size": this.size,
            "type": this.type,
            "data": args,
        } );

        // operation cancelled
        if ( this.#isFinished ) return;

        // server error
        if ( !res.ok ) return this._finish( res );

        const id = res.data.id,
            chunkSize = res.data.chunkSize,
            hashIsRequired = res.data.hashIsRequired;

        // create file handle
        try {
            this.#fh = await api.uploadOpenFile( file );
        }
        catch ( e ) {
            return this._finish( result( [500, e.message] ) );
        }

        // operation cancelled
        if ( this.#isFinished ) return;

        var offset = 0;

        // calculating hash
        if ( hashIsRequired ) {

            // operation cancelled
            if ( this._setProgress( STATUS.HASH, 0 ) ) return;

            const hash = await api.uploadCreateHashObject();

            // calculate hash
            while ( 1 ) {
                let chunk;

                try {
                    chunk = await api.uploadReadFileChunk( this.#fh, offset, chunkSize );
                }
                catch ( e ) {

                    // chunk read error
                    return this._finish( result( [500, e.message] ) );
                }

                // operation cancelled
                if ( this.#isFinished ) return;

                hash.update( chunk );

                offset += chunk.byteLength;

                // operation cancelled
                if ( this._setProgress( STATUS.HASH, offset / this.size ) ) return;

                // last chunk
                if ( offset >= this.size ) break;
            }

            // send hash
            res = await api.call( method, {
                "id": id,
                "hash": hash.digest( "hex" ),
            } );

            // operation cancelled
            if ( this.#isFinished ) return;

            if ( !res.ok ) return this._finish( res );
        }

        offset = 0;

        // operation cancelled
        if ( this._setProgress( STATUS.UPLOADING, 0 ) ) return;

        // send file body
        while ( 1 ) {
            let chunk;

            try {
                chunk = await api.uploadReadFileChunk( this.#fh, offset, chunkSize );
            }
            catch ( e ) {

                // chunk read error
                return this._finish( result( [500, e.message] ) );
            }

            // operation cancelled
            if ( this.#isFinished ) return;

            // upload chunk
            res = await api.uploadChunk( method, id, offset, chunk );

            // operation cancelled
            if ( this.#isFinished ) return;

            offset += chunk.byteLength;

            // server error
            if ( !res.ok ) {
                return this._finish( res );
            }
            else {

                // operation cancelled
                if ( this._setProgress( STATUS.UPLOADING, offset / this.size ) ) return;

                // last chunk
                if ( offset >= this.size ) return this._finish( res );
            }
        }
    }

    _setProgress ( reason, progress ) {
        if ( reason != null ) this.reason = reason;

        if ( progress != null ) this.progress = progress;

        if ( this.#onProgress ) this.#onProgress( this, this.reason, this.progress );

        // operation is finished
        if ( this.#isFinished ) return true;
    }

    _finish ( res ) {

        // already finished
        if ( this.#isFinished ) return;

        // mark as finished
        this.#isFinished = true;

        this.ok = res.ok;
        this.status = res.status;
        this.data = res.data;

        if ( res.ok ) {
            this._setProgress( STATUS.DONE, 1 );
        }
        else {
            this._setProgress( res.reason );
        }

        // close fh
        if ( this.#fh ) {
            this.#api.uploadCloseFile( this.#fh );

            this.#fh = null;
        }

        // cleanup
        this.#api = null;
        this.#onProgress = null;
    }
};
