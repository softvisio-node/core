export default class {
    #buckets;
    #location;

    constructor ( buckets, location ) {
        this.#buckets = buckets;
        this.#location = location;
    }

    // properties
    get app () {
        return this.storage.app;
    }

    get dbh () {
        return this.storage.dbh;
    }

    get storage () {
        return this.#buckets.storage;
    }

    get location () {
        return this.#location;
    }

    // public
    async uploadImage ( image, file, { encrypt, dbh } = {} ) {
        if ( encrypt && !this.app.crypto ) return result( [ 500, "Unable to encrypt file" ] );

        return this._uploadImage( image, file, { encrypt, dbh } );
    }

    async getFile ( file, { dbh } = {} ) {
        if ( file.isEncrypted && !this.app.crypto ) return result( [ 500, "Unable to decrypt file" ] );

        const res = await this.getStream( file, { dbh } );
        if ( !res.ok ) return res;

        const stream = res.data,
            tmpFile = await stream.tmpFile( {
                "name": file.name,
                "type": file.contentType,
            } );

        return result( 200, tmpFile );
    }

    async getBuffer ( file, { dbh } = {} ) {
        if ( file.isEncrypted && !this.app.crypto ) return result( [ 500, "Unable to decrypt file" ] );

        const res = await this._getBuffer( file, { dbh } );
        if ( !res.ok ) return res;

        // decrypt buffer
        if ( file.isEncrypted ) {
            try {
                res.data = await this.app.crypto.decrypt( res.data );
            }
            catch ( e ) {
                return result.catch( e );
            }
        }

        return res;
    }

    async getStream ( file, { offset, length, dbh } = {} ) {
        if ( file.isEncrypted && !this.app.crypto ) return result( [ 500, "Unable to decrypt file" ] );

        const res = await this._getStream( file, { offset, length, dbh } );

        res.data?.setName( file.name );
        res.data?.setType( file.contentType );
        res.data?.setSize( file.size );

        return res;
    }

    // XXX
    async downloadFile ( req, file, headers, { dbh } = {} ) {
        if ( file.isEncrypted && !this.app.crypto ) return req.end( 404 );

        return req.end( {
            "headers": headers,
            "body": async () => {

                // { unit: 'bytes', isMultiple: false, ranges: [ { start: 2, end: 4 } ] }
                const range = req.headers.range;

                // 416 Requested Range Not Satisfiable
                // Content-Range: bytes */1000
                //
                // HTTP/1.1 206 Partial Content
                // Content-Type: multipart/byteranges; boundary=THIS_STRING_SEPARATES_PARTS
                //
                // --THIS_STRING_SEPARATES_PARTS
                // Content-Type: text/plain
                // Content-Range: bytes 0-499/1234

                const start = range.ranges[ 0 ].start,
                    end = range.ranges[ 0 ].end;

                const res = await this.getStream( file, {
                    "offset": start,
                    "length": end - start,
                } );

                if ( !res.ok ) {
                    return result( res.status );
                }
                else {
                    const headers = {};

                    if ( range ) {
                        res.data.setSize( end - start );
                        console.log( "---", res.data );

                        headers[ "content-length" ] = file.size;

                        headers[ "content-range" ] = `bytes ${ start }-${ end }/${ file.size }`;
                    }

                    return result( 206, {
                        headers,
                        "body": res.data,
                    } );
                }
            },
        } );
    }
}
