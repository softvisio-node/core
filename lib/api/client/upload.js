const result = require( "../../result" );
const STATUS_NEW = "new";
const STATUS_STARTING = "starting";
const STATUS_HASH = "hash";
const STATUS_UPLOADING = "uploading";
const STATUS_DONE = "done";
const STATUS_ERROR = "error";
const STATUS_CANCELLED = "cancelled";

module.exports = class Upload {
    #isStarted = false;
    #onProgress;

    name;
    size;
    type;

    // progress
    opetaion = ""; // starting, calculating hash, uploading, done, error, cancelled
    progress = 0;

    // result
    status;
    reason;
    data;

    cancel () {
        if ( this.isFinished() ) {
            return;
        }

        this._setStatus( STATUS_CANCELLED );
    }

    // STATUS CHECK METHODS
    isNew () {
        return this.status === STATUS_NEW;
    }

    isStarting () {
        return this.status === STATUS_STARTING;
    }

    isCalculatingHash () {
        return this.status === STATUS_HASH;
    }

    isUploading () {
        return this.status === STATUS_UPLOADING;
    }

    isOk () {
        return this.status === STATUS_DONE;
    }

    isError () {
        return this.status === STATUS_ERROR;
    }

    isStarted () {
        return !this.isNew() && !this.isFinished();
    }

    isFinished () {
        return this.isCancelled() || this.isError() || this.isOk();
    }

    isCancelled () {
        return this.status === STATUS_CANCELLED;
    }

    toString () {
        if ( this.isError() ) {
            return this.result.reason;
        }
        else {
            return this.status;
        }
    }

    // PRIVATE METHODS
    async start ( api, method, args, file, onProgress ) {
        if ( this.#isStarted ) return;

        this.#isStarted = true;

        this.#onProgress = onProgress;

        this.name = api.uploadGetFileName( file );

        this._setPropgress( "Starting" );

        // get file stats
        try {
            const stats = await api.uploadGetFileStats( file );

            this.size = stats.size;
            this.type = stats.type;
        }
        catch ( e ) {
            return this._onRequestError( result( [500, e.message] ) );
        }

        var res = await api.call( method, {
            "name": this.name,
            "size": this.size,
            "type": this.type,
            "data": args,
        } );

        if ( this.isFinished() ) return;

        if ( !res.isOk() ) return this._onRequestError( res );

        const id = res.data.id,
            chunkSize = res.data.chunkSize,
            hashIsRequired = res.data.hashIsRequired;

        // create file handle
        try {
            var fh = await api.uploadOpenFile( file );
        }
        catch ( e ) {
            return this._onRequestError( result( [500, e.message] ) );
        }

        var offset = 0;

        // hash is required
        if ( hashIsRequired ) {
            this._setPropgress( "Calculating hash" );

            const hash = await api.uploadCreateHashObject();

            // calculate hash
            while ( 1 ) {
                const chunk = await api.uploadReadFileChunk( fh, offset, chunkSize );

                if ( this.isFinished() ) return;

                // chunk read error
                if ( !chunk ) return this._onRequestError( result( [500, "File read error"] ) );

                hash.update( chunk );

                offset += chunk.length;

                this._setPropgress( null, offset / this.size );

                // finished read file
                if ( offset >= this.size ) break;
            }

            // send hash
            res = await api.call( method, {
                "id": id,
                "hash": hash.digest( "hex" ),
            } );

            if ( this.isFinished() ) return;

            if ( !res.isOk() ) return this._onRequestError( res );
        }

        offset = 0;

        this._setPropgress( "Uploading" );

        // send file body
        while ( 1 ) {
            const chunk = await api.uploadReadFileChunk( fh, offset, chunkSize );

            if ( this.isFinished() ) return;

            // chunk read error
            if ( !chunk ) return this._onRequestError( result( [500, "File read error"] ) );

            // upload chunk
            res = await api.call( method, {
                "id": id,
                offset,
                chunk,
            } );

            if ( this.isFinished() ) return;

            if ( !res.isOk() ) return this._onRequestError( res );

            offset += chunk.length;

            this._setPropgress( null, offset / this.size );

            // finished read file
            if ( offset >= this.size ) {
                this.result = res;
                this.data = res.data;

                break;
            }
        }

        this._setPropgress( "Done", 1 );
    }

    _setPropgress ( operation, progress ) {
        if ( operation != null ) this.operation = operation;

        this.progress = progress || 0;

        if ( this.#onProgress ) this.#onProgress( this, this.operation, this.progress );
    }

    _setStatus ( status, progress ) {
        this.status = status;
        this.progress = progress;

        if ( this.#onProgress ) {
            this.#onProgress( this, progress );
        }

        if ( this.isFinished() ) {
            this.#onProgress = null;

            if ( this._onFinish ) {
                this._onFinish( this );

                this._onFinish = null;
            }
        }
    }

    _onRequestError ( res ) {
        if ( this.isFinished() ) {
            return;
        }

        this.result = res;
        this.data = res.data;

        this._setStatus( STATUS_ERROR );
    }
};
