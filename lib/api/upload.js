const jsSHA = require( "jssha" );

module.exports = class Upload {
    constructor ( api, method, file, onProgress ) {
        // public
        this.onFinish = null;
        this.chunkSize = 1024 * 1024;
        this.id = null;
        this.status = "new";
        this.reason = null;
        this.progress = null;
        this.hash = null;
        this.hashIsRequired = null;

        // private
        this._api = api;
        this._method = method;
        this._file = file;
        this._onProgress = onProgress;
    }

    _call () {
        return this._api.call( this._method, ...arguments );
    }

    start ( data, onFinish ) {
        const me = this;

        this.onFinish = onFinish;

        this._startUpload( data, () => {
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

        this._setStatus( "cancelled" );
    }

    isNew () {
        return this.status === "new";
    }

    isStarting () {
        return this.status === "starting";
    }

    isCalculatingHash () {
        return this.status === "hash";
    }

    isUploading () {
        return this.status === "uploading";
    }

    isCancelled () {
        return this.status === "cancelled";
    }

    isError () {
        return this.status === "error";
    }

    isDone () {
        return this.status === "done";
    }

    isStarted () {
        return !this.isNew() && !this.isFinished();
    }

    isFinished () {
        return this.isCancelled() || this.isError() || this.isDone();
    }

    _setStatus ( status, progress ) {
        this.status = status;
        this.progress = progress;

        if ( this.onProgress ) {
            this.onProgress( this, status, this.reason, progress );
        }

        if ( this.isFinished() ) {
            this.onProgress = null;

            if ( this.onFinish ) {
                this.onFinish( this );

                this.onFinish = null;
            }
        }
    }

    _onRequestError ( res ) {
        if ( this.isFinished() ) {
            return;
        }

        this.reason = res;

        this._setStatus( "error" );
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

                    me._setStatus( "hash", offset / me._file.size );

                    readChunk();
                }

                // Finished
                else {
                    me.hash = hash.getHash( "HEX" );

                    me._setStatus( "hash", 1 );

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

        this._setStatus( "starting", 0 );

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

        this._setStatus( "hash", 0 );

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

        this._setStatus( "uploading", 0 );

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
                        me._setStatus( "uploading", offset / me._file.size );

                        readChunk();
                    }
                } );
            }

            // Finished
            else {
                me._setStatus( "done", 1 );
            }
        } );

        readChunk();
    }
};
