const { mixin } = require( "../../mixins" );
const fs = require( "../../fs" );
const path = require( "path" );
const result = require( "../../result" );
const { "v4": uuidv4 } = require( "uuid" );
const crypto = require( "crypto" );

module.exports = mixin( ( Super ) =>

/** class: Upload
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

                    const id = ( args.id = uuidv4() );

                    args.auth = auth;
                    args.uploadedSize = 0;

                    const res = await onStart( args );

                    // upload rejected
                    if ( !res.isOk() ) {
                        return res;
                    }

                    // upload accepted
                    else {
                        this.#uploads[id] = args;

                        if ( onHash ) {
                            args.hashIsRequired = true;

                            args.serverHash = crypto.createHash( "SHA1" );
                        }

                        this._setUploadTimer( id );

                        return result( 200, {
                            id,
                            "chunkSize": this.uploadChunkSize,
                            "hashIsRequired": args.hashIsRequired,
                        } );
                    }
                }

                // continue upload
                else {
                    const upload = this.#uploads[args.id];

                    if ( !upload ) return result( [400, "Upload is invalid or expired"] );

                    if ( upload.hashIsRequired && !upload.clientHash ) {
                        if ( !args.hash ) {
                            this._removeUpload( upload.id );

                            return result( [400, "File hash is required"] );
                        }
                        else {
                            upload.clientHash = args.hash;

                            const res = onHash( upload );

                            if ( !res.isOk() ) this._removeUpload( upload.id );

                            return res;
                        }
                    }

                    upload.uploadedSize += args.chunk.length;

                    // console.log(Buffer.from(args.chunk).toString());

                    if ( upload.serverHash ) upload.serverHash.update( args.chunk );

                    if ( !upload.file ) {
                        upload.file = fs.tmp.file( { "ext": path.extname( upload.name ) } );
                        console.log( "----- OPEN" );
                        upload.fh = fs.createWriteStream( upload.file );
                    }

                    upload.fh.write( Buffer.from( args.chunk ) );

                    // upload is not finished
                    if ( upload.uploadedSize < upload.size ) {
                        this._setUploadTimer( upload.id );

                        return result( 200 );
                    }

                    // upload is finished
                    else if ( upload.uploadedSize === upload.size ) {
                        this._removeUpload( upload.id );

                        // compare hash
                        if ( upload.hashIsRequired ) {
                            upload.serverHash = upload.serverHash.digest( "hex" );

                            // hash is invalid
                            if ( upload.clientHash !== upload.serverHash ) return result( [400, "File hash is invalid"] );
                        }

                        return onFinish( upload );
                    }

                    // invalid upload size
                    else {
                        this._removeUpload( upload.id );

                        return result( [400, "File size is invalid"] );
                    }
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
