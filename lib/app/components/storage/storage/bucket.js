import path from "node:path";

export default class {
    #storage;
    #location;
    #deduplicate;

    constructor ( storage, location, deduplicate ) {
        this.#storage = storage;
        this.#location = location;
        this.#deduplicate = !!deduplicate;
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

    get deduplicate () {
        return this.#deduplicate;
    }

    // public
    createImagePath ( filePath, hash, encrypt ) {
        if ( this.deduplicate ) {
            var imagePath = path.posix.join( this.location, hash.substring( 0, 2 ), hash.substring( 2, 4 ), hash );

            if ( encrypt ) imagePath += "-encrypted";

            return imagePath;
        }
        else {
            return filePath;
        }
    }

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
