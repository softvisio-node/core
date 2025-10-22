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
    async uploadImage ( imagePath, file, { encrypt, dbh } = {} ) {
        if ( encrypt && !this.app.crypto ) return result( [ 500, "Unable to encrypt file" ] );

        return this._uploadImage( imagePath, file, { encrypt, dbh } );
    }

    async getFile ( file, { dbh } = {} ) {
        if ( file.isEncrypted && !this.app.crypto ) return result( [ 500, "Unable to decrypt file" ] );

        return this._getFile( file, { dbh } );
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

    // XXX
    async getStream ( file, { dbh } = {} ) {
        if ( file.isEncrypted && !this.app.crypto ) return result( [ 500, "Unable to decrypt file" ] );

        const res = await this._getStream( file, { dbh } );
        if ( !res.ok ) return res;

        var stream = res.data;

        // decrypt stream
        if ( file.isEncrypted ) {
            try {
                stream = await this.app.crypto.decrypt( stream );
            }
            catch ( e ) {
                stream.destroy();

                return result.catch( e );
            }
        }

        // XXX
        stream.setName( file.name );
        stream.setSize( file.size );

        return result( 200, stream );
    }

    async downloadFile ( req, file, headers, { dbh } = {} ) {
        if ( file.isEncrypted && !this.app.crypto ) return req.end( 404 );

        return this._downloadFile( req, file, headers, { dbh } );
    }

    // protected
    async _downloadFile ( req, file, headers, { dbh } = {} ) {
        dbh ||= this.dbh;

        const res = await this.getStream( file, { dbh } );
        if ( !res.ok ) return req.end( res );

        return req.end( {
            headers,
            "body": res.data,
        } );
    }

    // XXX
    async _getStream ( file, { dbh } = {} ) {
        const res = await this.getFile( file, { dbh } );
        if ( !res.ok ) return res;

        const stream = res.data.stream();

        return result( 200, stream );
    }
}
