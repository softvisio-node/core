export default class {
    #storage;
    #location;

    constructor ( storage, location ) {
        this.#storage = storage;
        this.#location = location;
    }

    // properties
    get app () {
        return this.#storage.app;
    }

    get storage () {
        return this.#storage;
    }

    get location () {
        return this.#location;
    }

    // public
    async uploadImage ( imagePath, file, { encrypt } = {} ) {
        if ( encrypt && !this.app.crypto ) return result( [ 500, `Unable to encrypt file` ] );

        return this._uploadImage( imagePath, file, { encrypt } );
    }

    async getFile ( file ) {
        if ( file.isEncrypted && !this.app.crypto ) return result( [ 500, `Unable to decrypt file` ] );

        return this._getFile( file );
    }

    async getBuffer ( file ) {
        if ( file.isEncrypted && !this.app.crypto ) return result( [ 500, `Unable to decrypt file` ] );

        return this._getBuffer( file );
    }

    async downloadFile ( req, file, headers ) {
        if ( file.isEncrypted && !this.app.crypto ) return req.end( 404 );

        return this._downloadFile( req, file, headers );
    }
}
