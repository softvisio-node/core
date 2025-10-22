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

        return this._getBuffer( file, { dbh } );
    }

    async downloadFile ( req, file, headers, { dbh } = {} ) {
        if ( file.isEncrypted && !this.app.crypto ) return req.end( 404 );

        return this._downloadFile( req, file, headers, { dbh } );
    }
}
