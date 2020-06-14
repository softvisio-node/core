const result = require( "../../result" );
const STATUS = {
    "STARTING": "Starting",
    "HASH": "Calculating hash",
    "UPLOADING": "Uploading",
    "DONE": "Done",
    "ERROR": "Error",
    "CANCELLED": "Cancelled",
};

module.exports = class Upload {
    #api;
    #fh;
    #isStarted = false;
    #isFinished = false;
    #hasError = false;
    #onProgress;

    name;
    size;
    type;

    // result
    status;
    reason;
    progress = 0;
    data;

    cancel () {
        this._finish( result( [400, STATUS.CANCELLED] ) );
    }

    // PRIVATE METHODS
    async start ( api, method, args, file, onProgress ) {
        if ( this.#isStarted ) return;

        this.#isStarted = true;
        this.#api = api;
        this.#onProgress = onProgress;

        this.name = api.uploadGetFileName( file );

        this._setProgress( STATUS.STARTING, 0 );

        // operation cancelled
        if ( this.#isFinished ) return;

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
        if ( !res.isOk() ) return this._finish( res );

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
            this._setProgress( STATUS.HASH, 0 );

            // operation cancelled
            if ( this.#isFinished ) return;

            const hash = await api.uploadCreateHashObject();

            // calculate hash
            while ( 1 ) {
                const chunk = await api.uploadReadFileChunk( this.#fh, offset, chunkSize );

                // operation cancelled
                if ( this.#isFinished ) return;

                // chunk read error
                if ( !chunk ) return this._finish( result( [500, "File read error"] ) );

                hash.update( chunk );

                offset += chunk.length;

                this._setProgress( STATUS.HASH, offset / this.size );

                // operation cancelled
                if ( this.#isFinished ) return;

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

            if ( !res.isOk() ) return this._finish( res );
        }

        offset = 0;

        this._setProgress( STATUS.UPLOADING, 0 );

        // operation cancelled
        if ( this.#isFinished ) return;

        // send file body
        while ( 1 ) {
            const chunk = await api.uploadReadFileChunk( this.#fh, offset, chunkSize );

            // operation cancelled
            if ( this.#isFinished ) return;

            // chunk read error
            if ( !chunk ) return this._finish( result( [500, "File read error"] ) );

            // upload chunk
            res = await api.call( method, {
                "id": id,
                offset,
                chunk,
            } );

            // operation cancelled
            if ( this.#isFinished ) return;

            offset += chunk.length;

            // server error
            if ( !res.isOk() ) {
                return this._finish( res );
            }
            else {
                this._setProgress( STATUS.UPLOADING, offset / this.size );

                // operation cancelled
                if ( this.#isFinished ) return;

                // last chunk
                if ( offset >= this.size ) return this._finish( res );
            }
        }
    }

    _setProgress ( reason, progress ) {
        if ( reason != null ) this.reason = reason;

        if ( progress != null ) this.progress = progress;

        if ( this.#onProgress ) this.#onProgress( this, this.reason, this.progress );
    }

    _finish ( res ) {

        // close file handle
        if ( this.#fh ) {
            this.#api.uploadCloseFile( this.#fh );

            this.#fh = null;
        }

        // already finished
        if ( this.#isFinished ) return;

        // mark as finished
        this.#isFinished = true;

        this.status = res.status;
        this.data = res.data;

        if ( res.isOk() ) {
            this._setProgress( STATUS.DONE, 1 );
        }
        else {
            this.#hasError = true;

            this._setProgress( res.reason );
        }

        // remove callback
        this.#onProgress = null;
    }
};
