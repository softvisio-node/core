const result = require( "../../result" );
const STATUS_NEW = "new";
const STATUS_STARTING = "starting";
const STATUS_HASH = "hash";
const STATUS_UPLOADING = "uploading";
const STATUS_DONE = "done";
const STATUS_ERROR = "error";
const STATUS_CANCELLED = "cancelled";

module.exports = class Upload {

    // public
    file = null;
    id = null;
    status = STATUS_NEW;
    result = null;
    data = null;
    progress = null;
    hash = null;

    // private
    #onProgress;

    constructor ( file, onProgress ) {

        // public
        this.file = file;

        // private
        this.#onProgress = onProgress;
    }

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
    async start ( api, method, args ) {
        if ( this.isFinished() ) return;

        this._setStatus( STATUS_STARTING, 0 );

        const fileParams = await api.uploadGetFileParams( this.file );

        if ( !fileParams ) return this._onRequestError( result( [500, "File read error"] ) );

        const fileSize = fileParams.size;

        var res = await api.call( method, {
            ...fileParams,
            "data": args,
        } );

        if ( this.isFinished() ) return;

        if ( !res.isOk() ) return this._onRequestError( res );

        this.id = res.data.id;

        const chunkSize = res.data.chunkSize;

        var offset;

        // hash is required
        if ( res.data.hashIsRequired ) {
            this._setStatus( STATUS_HASH, 0 );

            const sha1 = await api.uploadCreateHashObject();

            offset = 0;

            // calculate hash
            while ( 1 ) {
                const chunk = await api.uploadReadFileChunk( this.file, offset, chunkSize );

                if ( this.isFinished() ) return;

                // chunk read error
                if ( !chunk ) return this._onRequestError( result( [500, "File read error"] ) );

                sha1.update( chunk );

                offset += chunk.length;

                this._setStatus( STATUS_HASH, offset / fileSize );

                // finished read file
                if ( offset >= fileSize ) break;
            }

            this.hash = sha1.digest( "hex" );

            // send hash
            res = await api.call( method, {
                "id": this.id,
                "hash": this.hash,
            } );

            if ( this.isFinished() ) return;

            if ( !res.isOk() ) return this._onRequestError( res );
        }

        offset = 0;

        this._setStatus( STATUS_UPLOADING, 0 );

        // send file body
        while ( 1 === 1 ) {
            const chunk = await api.uploadReadFileChunk( this.file, offset, chunkSize );

            if ( this.isFinished() ) return;

            // chunk read error
            if ( !chunk ) return this._onRequestError( result( [500, "File read error"] ) );

            // upload chunk
            res = await api.call( method, {
                "id": this.id,
                offset,
                chunk,
            } );

            if ( this.isFinished() ) return;

            if ( !res.isOk() ) return this._onRequestError( res );

            offset += chunk.length;

            this._setStatus( STATUS_UPLOADING, offset / fileSize );

            // finished read file
            if ( offset >= fileSize ) {
                this.result = res;
                this.data = res.data;

                break;
            }
        }

        this._setStatus( STATUS_DONE, 1 );
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
