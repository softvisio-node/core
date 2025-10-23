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

    async downloadFile ( req, file, headers, { dbh } = {} ) {
        if ( file.isEncrypted && !this.app.crypto ) return req.end( 404 );

        return this._downloadFile( req, file, headers, { dbh } );
    }

    // protected
    // XXX range support
    async _downloadFile ( req, file, headers, { dbh } = {} ) {
        dbh ||= this.dbh;

        const res = await this.getStream( file, { dbh } );
        if ( !res.ok ) return req.end( res );

        return req.end( {
            headers,
            "body": res.data,
        } );
    }
}
