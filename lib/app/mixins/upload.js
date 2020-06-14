const { mixin } = require( "../../mixins" );
const fs = require( "../../fs" );
const path = require( "path" );
const result = require( "../../result" );
const { "v4": uuidv4 } = require( "uuid" );
const crypto = require( "crypto" );

class Upload {
    #api;
    #id;
    #serverHash;
    #uploadedSize = 0;
    #onHash;
    #onFinish;
    #stream;

    fileName;
    size;
    type;
    hash;
    auth;
    data;
    path;

    constructor ( api, id, auth, args, onFinish, onHash ) {
        this.#api = api;
        this.#id = id;
        this.auth = auth;

        this.fileName = args.name;
        this.size = args.size;
        this.type = args.type;
        this.data = args.data;

        this.#onHash = onHash;
        this.#onFinish = onFinish;

        if ( this.#onHash ) this.#serverHash = crypto.createHash( "SHA1" );
    }

    async addChunk ( args ) {

        // process hash
        if ( this.#onHash && !this.hash ) {
            if ( !args.hash ) {
                this.#api._removeUpload( this.#id );

                return result( [400, "File hash is required"] );
            }
            else {
                this.hash = args.hash;

                const res = await this.#onHash( this );

                this.#onHash = null;

                if ( !res.isOk() ) this.#api._removeUpload( this.#id );

                return res;
            }
        }

        this.#uploadedSize += args.chunk.length;

        if ( this.serverHash ) this.serverHash.update( args.chunk );

        if ( !this.path ) {
            this.path = fs.tmp.file( { "ext": path.extname( this.fileName ) } );

            this.#stream = fs.createWriteStream( this.path );
        }

        this.#stream.write( args.chunk );

        // upload is not finished
        if ( this.#uploadedSize < this.size ) {
            this.#api._setUploadTimer( this.#id );

            return result( 200 );
        }

        // upload is finished
        else if ( this.#uploadedSize === this.size ) {
            this.#api._removeUpload( this.#id );

            // close stream
            this.#stream.end();
            this.#stream = null;

            // compare hash
            if ( this.hash ) {
                this.#serverHash = this.#serverHash.digest( "hex" );

                // hash is invalid
                if ( this.hash !== this.#serverHash ) return result( [400, "File hash is invalid"] );
            }

            const res = await this.#onFinish( this );

            this.#onFinish = null;

            return res;
        }

        // invalid upload size
        else {
            this.#api._removeUpload( this.#id );

            return result( [400, "File size is invalid"] );
        }
    }
}

module.exports = mixin( ( Super ) =>

/** class: UploadMixin
         *
         */
    class extends Super {
            uploadIdleTimeout = 1000 * 15;
            uploadChunkSize = 1024 * 1024; // 1Mb
            uploadMaxSize = 1024 * 50; // 50Mb
            uploadFilenameIsRequired = true;

            #api;
            #dbh;
            #uploads = {};
            #uploadTimers = {};

            constructor ( app, api, options ) {
                super( app, api, options );

                this.#api = api;
                this.#dbh = options.dbh;
            }

            async _upload ( auth, args, onStart, onFinish, onHash ) {
                if ( !args ) args = {};

                // upload started
                if ( !args.id ) {

                    // file size is required
                    if ( !args.size ) return result( [400, "File size is required"] );

                    // file is too large
                    if ( this.uploadMaxSize && args.size > this.uploadMaxSize ) return result( [400, "File is too large"] );

                    if ( this.uploadFilenameIsRequired && ( args.name == null || args.name === "" ) ) return result( [400, "File name is required"] );

                    const id = uuidv4();

                    const upload = new Upload( this, id, auth, args, onHash, onFinish );

                    const res = await onStart( upload );

                    // upload rejected
                    if ( !res.isOk() ) {
                        return res;
                    }

                    // upload accepted
                    else {
                        this.#uploads[id] = upload;

                        this._setUploadTimer( id );

                        return result( 200, {
                            id,
                            "chunkSize": this.uploadChunkSize,
                            "hashIsRequired": !!onHash,
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

            _setUploadTimer ( id ) {
                if ( this.#uploadTimers[id] ) clearTimeout( this.#uploadTimers[id] );

                this.#uploadTimers[id] = setTimeout( () => {
                    this._removeUpload( id );
                }, this.uploadIdleTimeout );
            }

            // TODO clean temp
            _removeUpload ( id ) {
                if ( this.#uploadTimers[id] ) {
                    clearTimeout( this.#uploadTimers[id] );

                    delete this.#uploadTimers[id];
                }

                if ( this.#uploads[id] ) {
                    delete this.#uploads[id];
                }
            }
    } );
