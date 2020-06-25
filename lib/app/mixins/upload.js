const { mixin } = require( "../../mixins" );
const fs = require( "../../fs" );
const path = require( "path" );
const result = require( "../../result" );
const { "v4": uuidv4 } = require( "uuid" );
const crypto = require( "crypto" );

class Upload {
    #api;
    #idleTimeout;
    #serverHash;
    #uploadedSize = 0;
    #onHash;
    #onFinish;
    #stream;
    #timeoutId;
    #isFinished;
    #isDestroyed;

    id;
    fileName;
    size;
    type;
    hash;
    auth;
    data;
    path;

    constructor ( api, idleTimeout, auth, args, onFinish, onHash ) {
        this.id = uuidv4();

        this.#api = api;
        this.#idleTimeout = idleTimeout;
        this.auth = auth;

        this.fileName = args.name;
        this.size = args.size;
        this.type = args.type;
        this.data = args.data;

        this.#onHash = onHash;
        this.#onFinish = onFinish;
    }

    async start ( onStart ) {
        if ( onStart ) {
            const res = await onStart( this );

            if ( !res.isOk() ) return res;
        }

        this._setIdleTimeout();

        return result( 200 );
    }

    _setIdleTimeout () {
        this._clearIdleTimeout();

        this.#timeoutId = setTimeout( () => {
            this.destroy();
        }, this.#idleTimeout );
    }

    _clearIdleTimeout () {
        if ( this.#timeoutId ) {
            clearTimeout( this.#timeoutId );

            this.#timeoutId = null;
        }
    }

    async addChunk ( args ) {
        this._clearIdleTimeout();

        // process hash
        if ( this.#onHash && !this.hash ) {

            // hash is required
            if ( !args.hash ) {
                this.destroy();

                return result( [400, "File hash is required"] );
            }
            else {
                this.hash = args.hash;

                const res = await this.#onHash( this );

                if ( !res.isOk() ) {
                    this.destroy();
                }
                else {
                    this.#serverHash = crypto.createHash( "SHA1" );

                    this._setIdleTimeout();
                }

                return res;
            }
        }

        if ( this.#serverHash ) this.#serverHash.update( args.chunk );

        // create temp path and write stream
        if ( !this.path ) {
            this.path = fs.tmp.file( { "ext": path.extname( this.fileName ) } );

            this.#stream = fs.createWriteStream( this.path );
        }

        // write chunk
        this.#stream.write( args.chunk );

        this.#uploadedSize += args.chunk.byteLength;

        // upload is not finished
        if ( this.#uploadedSize < this.size ) {
            this._setIdleTimeout();

            return result( 200 );
        }

        // upload is finished
        else if ( this.#uploadedSize === this.size ) {
            const onFinish = this.#onFinish;

            this._finish();

            // compare hash
            if ( this.hash ) {
                this.#serverHash = this.#serverHash.digest( "hex" );

                // hash is invalid
                if ( this.hash !== this.#serverHash ) {
                    this.destroy();

                    return result( [400, "File hash is invalid"] );
                }
            }

            const res = await onFinish( this );

            this.destroy();

            return res;
        }

        // invalid upload size
        else {
            this.destroy();

            return result( [400, "File size is invalid"] );
        }
    }

    _finish () {
        if ( this.#isFinished ) return;

        this.#isFinished = true;

        this._clearIdleTimeout();

        this.#api.finishUpload( this.id );

        this.#api = null;
        this.#onHash = null;
        this.#onFinish = null;

        // close stream
        if ( this.#stream ) {
            this.#stream.end();
            this.#stream = null;
        }
    }

    destroy () {
        if ( this.#isDestroyed ) return;

        this.#isDestroyed = true;

        this._finish();

        if ( this.path ) {
            fs.unlinkSync( this.path );

            this.path = null;
        }
    }
}

module.exports = mixin( ( Super ) =>

/** class: UploadMixin
         *
         */
    class extends Super {
            uploadIdleTimeout = 1000 * 30; // 30 seconds
            uploadMaxSize = 1024 * 1024 * 50; // 50Mb
            uploadFileNameIsRequired = true;
            uploadChunkSize = 1024 * 1024; // 1Mb

            #api;
            #dbh;
            #uploads = {};

            constructor ( app, api, options ) {
                super( app, api, options );

                this.#api = api;
                this.#dbh = options.dbh;

                process.on( "beforeExit", () => {
                    for ( const uploadId in this.#uploads ) {
                        this.#uploads[uploadId].destroy();
                    }
                } );
            }

            async _upload ( auth, args, onFinish, options = {} ) {
                if ( !args ) args = {};

                // upload started
                if ( !args.id ) {

                    // file size is required
                    if ( !args.size ) return result( [400, "File size is required"] );

                    // file is too large
                    if ( this.uploadMaxSize && args.size > this.uploadMaxSize ) return result( [400, "File is too large"] );

                    if ( this.uploadFileNameIsRequired && ( args.name == null || args.name === "" ) ) return result( [400, "File name is required"] );

                    const upload = new Upload( this, this.uploadIdleTimeout, auth, args, onFinish, options.onHash );

                    const res = await upload.start( options.onStart );

                    // upload rejected
                    if ( !res.isOk() ) {
                        return res;
                    }

                    // upload accepted
                    else {
                        this.#uploads[upload.id] = upload;

                        return result( 200, {
                            "id": upload.id,
                            "chunkSize": this.uploadChunkSize,
                            "hashIsRequired": !!options.onHash,
                        } );
                    }
                }

                // continue upload
                else {
                    const upload = this.#uploads[args.id];

                    if ( !upload ) return result( [400, "Upload is invalid or expired"] );

                    return await upload.addChunk( args );
                }
            }

            finishUpload ( id ) {
                delete this.#uploads[id];
            }

            removeUpload ( id ) {
                if ( this.#uploads[id] ) {
                    this.#uploads[id].destroy();

                    delete this.#uploads[id];
                }
            }
    } );
