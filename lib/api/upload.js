const jsSHA = require( "jssha" );

const STATUS_NEW = "new";
const STATUS_STARTING = "starting";
const STATUS_CALC_HASH = "hash";
const STATUS_UPLOADING = "uploading";
const STATUS_CANCELLED = "cancelled";
const STATUS_ERROR = "error";
const STATUS_DONE = "done";

module.exports = class Upload {
    constructor ( api, method, file, args, onProgress, onFinish ) {
        // public
        this.chunkSize = 1024 * 1024; // 1 Mb, default chunk size
        this.id = null;
        this.status = STATUS_NEW;
        this.result = null;
        this.progress = null;
        this.hash = null;
        this.hashIsRequired = null;

        // private
        this._api = api;
        this._method = method;
        this._file = file;
        this._onProgress = onProgress;
        this._onFinish = onFinish;

        // start upload
        const me = this;

        this._startUpload( args, () => {
            if ( me.hashIsRequired ) {
                me._sendHash( () => {
                    me._uploadBody();
                } );
            }
            else {
                me._uploadBody();
            }
        } );
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
        return this.status === STATUS_CALC_HASH;
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
    _call () {
        return this._api.call( this._method, ...arguments );
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

    _getFileReader ( cb ) {
        var me = this,
            offset = 0;

        return function () {
            const chunk = me._file.slice( offset, offset + me.chunkSize );

            // Finished
            if ( !chunk.size ) {
                cb();

                return;
            }

            const reader = new FileReader();

            reader.onload = function () {
                const oldOffset = offset;

                offset += me.chunkSize;

                cb( oldOffset, reader.result );
            };

            reader.readAsBinaryString( chunk );
        };
    }

    _getHash ( cb ) {
        if ( this.hash ) {
            cb( this.hash );

            return;
        }

        var me = this,
            hash = new jsSHA( "SHA-1", "BYTES" ),
            readChunk = me._getFileReader( ( offset, chunk ) => {
                // Upload is cancelled
                if ( me.isFinished() ) {
                    return;
                }

                // Next chunk
                if ( chunk !== undefined ) {
                    hash.update( chunk );

                    me._setStatus( STATUS_CALC_HASH, offset / me._file.size );

                    readChunk();
                }

                // Finished
                else {
                    me.hash = hash.getHash( "HEX" );

                    me._setStatus( STATUS_CALC_HASH, 1 );

                    cb( me.hash );
                }
            } );

        readChunk();
    }

    _startUpload ( data, cb ) {
        const me = this;

        if ( me.isFinished() ) {
            return;
        }

        this._setStatus( STATUS_STARTING, 0 );

        me._call( {
            "name": me._file.name,
            "size": me._file.size,
            "type": me._file.type,
            data,
        },
        ( res ) => {
            // Request error
            if ( !res.isSuccess() ) {
                me._onRequestError( res );
            }
            else {
                me.id = res.data.id;
                me.chunkSize = res.data.chunk_size;
                me.hashIsRequired = res.data.hash_is_required;

                cb();
            }
        } );
    }

    _sendHash ( cb ) {
        const me = this;

        if ( me.isFinished() ) {
            return;
        }

        this._setStatus( STATUS_CALC_HASH, 0 );

        me._getHash( ( hash ) => {
            me.hash = hash;

            me._call( {
                "id": me.id,
                hash,
            },
            ( res ) => {
                // Request error
                if ( !res.isSuccess() ) {
                    me._onRequestError( res );
                }
                else {
                    cb();
                }
            } );
        } );
    }

    _uploadBody () {
        const me = this;

        if ( me.isFinished() ) {
            return;
        }

        this._setStatus( STATUS_UPLOADING, 0 );

        var readChunk = me._getFileReader( ( offset, chunk ) => {
            // Upload is cancelled
            if ( me.isFinished() ) {
                return;
            }

            // Next chunk
            if ( chunk !== undefined ) {
                me._call( {
                    "id": me.id,
                    offset,
                    "chunk": btoa( chunk ),
                },
                ( res ) => {
                    // Upload is cancelled
                    if ( me.isFinished() ) {
                        return;
                    }

                    // Upload error
                    if ( !res.isSuccess() ) {
                        me._onRequestError( res );
                    }

                    // Chunk uploaded
                    else {
                        me._setStatus( STATUS_UPLOADING, offset / me._file.size );

                        readChunk();
                    }
                } );
            }

            // Finished
            else {
                me._setStatus( STATUS_DONE, 1 );
            }
        } );

        readChunk();
    }
};
