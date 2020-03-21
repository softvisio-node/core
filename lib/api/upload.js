const jsSHA = require( "jssha" );

const STATUS_NEW = "new";
const STATUS_STARTING = "starting";
const STATUS_HASH = "hash";
const STATUS_UPLOADING = "uploading";
const STATUS_DONE = "done";
const STATUS_ERROR = "error";
const STATUS_CANCELLED = "cancelled";

module.exports = class Upload {
    constructor ( api, method, file, onProgress ) {
        // public
        this.file = file;
        this.id = null;
        this.status = STATUS_NEW;
        this.result = null;
        this.progress = null;
        this.hash = null;

        // private
        this._onProgress = onProgress;
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

    isSuccess () {
        return this.status === STATUS_DONE;
    }

    isError () {
        return this.status === STATUS_ERROR;
    }

    isStarted () {
        return !this.isNew() && !this.isFinished();
    }

    isFinished () {
        return this.isCancelled() || this.isError() || this.isSuccess();
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
    async _start ( api, method, args ) {
        if ( this.isFinished() ) return;

        this._setStatus( STATUS_STARTING, 0 );

        var res = await api.call( method, {
            "name": this.file.name,
            "size": this.file.size,
            "type": this.file.type,
            "data": args,
        } );

        if ( this.isFinished() ) return;

        if ( !res.isSuccess() ) return this._onRequestError( res );

        this.id = res.data.id;

        const chunkSize = res.data.chunk_size;

        var offset;

        // hash is required
        if ( res.data.hash_is_required ) {
            this._setStatus( STATUS_HASH, 0 );

            const hash = new jsSHA( "SHA-1", "BYTES" );

            offset = 0;

            // calculate hash
            while ( 1 ) {
                const chunk = await this._readFileChunk( offset, chunkSize );

                if ( this.isFinished() ) return;

                // finished read file
                if ( chunk === undefined ) break;

                hash.update( chunk );

                offset += chunk.length;

                this._setStatus( STATUS_HASH, offset / this.file.size );
            }

            this.hash = hash.getHash( "HEX" );

            // send hash
            res = await api.call( method, {
                "id": this.id,
                "hash": this.hash,
            } );

            if ( this.isFinished() ) return;

            if ( !res.isSuccess() ) return this._onRequestError( res );
        }

        offset = 0;

        this._setStatus( STATUS_UPLOADING, 0 );

        // send file body
        while ( 1 === 1 ) {
            const chunk = await this._readFileChunk( offset, chunkSize );

            if ( this.isFinished() ) return;

            // finished read file
            if ( chunk === undefined ) break;

            // upload chunk
            res = await api.call( method, {
                "id": this.id,
                "offset": offset,
                "chunk": btoa( chunk ),
            } );

            if ( this.isFinished() ) return;

            if ( !res.isSuccess() ) return this._onRequestError( res );

            offset += chunk.length;

            this._setStatus( STATUS_UPLOADING, offset / this.file.size );
        }

        this._setStatus( STATUS_DONE, 1 );
    }

    async _readFileChunk ( offset, length ) {
        return new Promise( function ( resolve ) {
            const chunk = this.file.slice( offset, offset + length );

            // finished
            if ( !chunk.size ) {
                resolve();
            }
            else {
                const reader = new FileReader();

                reader.onload = function () {
                    resolve( reader.result );
                };

                reader.readAsBinaryString( chunk );
            }
        } );
    }

    _setStatus ( status, progress ) {
        this.status = status;
        this.progress = progress;

        if ( this._onProgress ) {
            this._onProgress( this, progress );
        }

        if ( this.isFinished() ) {
            this._onProgress = null;

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

        this._setStatus( STATUS_ERROR );
    }
};
// -----SOURCE FILTER LOG BEGIN-----
//
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
// | Sev.  | Line:Col      | Rule                         | Description                                                                    |
// |=======+===============+==============================+================================================================================|
// | ERROR | 111:21        | no-constant-condition        | Unexpected constant condition.                                                 |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 144:17        | no-constant-condition        | Unexpected constant condition.                                                 |
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
//
// -----SOURCE FILTER LOG END-----
