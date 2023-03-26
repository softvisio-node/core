import sql from "#lib/sql";
import CacheLru from "#lib/cache/lru";
import Mutex from "#lib/threads/mutex";

const SQL = {
    "get": sql`
SELECT
    storage_file.path,
    storage_file.storage_image_id,
    storage_file.last_modified,
    storage_file.content_type,
    storage_file.cache_control,
    storage_file.content_disposition,
    storage_file.expires,
    storage_image.size AS content_length,
    storage_image.hash
FROM
    storage_file,
    storage_image
WHERE
    storage_file.storage_image_id = storage_image.id
    AND storage_file.path = ?
    AND ( storage_file.expires IS NULL OR storage_file.expires > CURRENT_TIMESTAMP )
`.prepare(),
};

export default class {
    #dbh;
    #cache;
    #mutexSet = new Mutex.Set( { "destroyOnFinish": true } );

    constructor ( dbh, maxSize ) {
        this.#dbh = dbh;
        this.#cache = new CacheLru( { maxSize } );

        dbh.on( "storage/link/update", this.#onFileUpdate.bind( this ) );

        dbh.on( "storage/link/delete", this.#onFileDelete.bind( this ) );

        dbh.on( "disconnect", this.#onDisconnect.bind( this ) );
    }

    // public
    async get ( path ) {
        var file = this.#cache.get( path );

        if ( file ) {

            // file is expired
            if ( file.expires && file.expires <= new Date() ) {
                this.#cache.delete( path );

                file = null;
            }

            return file;
        }

        const mutex = this.#mutexSet.get( path );

        if ( !mutex.tryDown() ) return mutex.signal.wait();

        const res = await this.#dbh.selectRow( SQL.get, [path] );

        if ( res.data ) {
            file = this.#onFileUpdate( res.data );
        }

        mutex.signal.broadcast( file );
        mutex.up();

        return file;
    }

    delete ( path ) {
        this.#onFileDelete( { path } );
    }

    // private
    #onFileUpdate ( data ) {
        var expires;

        if ( data.expires ) {
            expires = new Date( data.expires );

            if ( expires <= new Date() ) {
                this.#cache.delete( data.path );

                return;
            }
        }

        data = {
            "path": data.path,
            "imageId": data.storage_image_id,
            "lastModified": new Date( data.last_modified ),
            "contentType": data.content_type,
            "cacheControl": data.cache_control,
            "contentDisposition": data.content_disposition,
            "contentLength": data.content_length,
            expires,
            "etag": data.hash,
            "headers": {
                "etag": data.hash,
                "accept-ranges": "bytes",
            },
        };

        data.headers["last-modified"] = data.lastModified.toUTCString();

        if ( data.contentType ) data.headers["content-type"] = data.contentType;
        if ( data.cacheControl ) data.headers["cache-control"] = data.cacheControl;
        if ( data.contentDisposition ) data.headers["content-disposition"] = data.contentDisposition;

        this.#cache.set( data.path, data );

        return data;
    }

    #onFileDelete ( data ) {
        this.#cache.delete( data.path );
    }

    #onDisconnect () {
        this.#cache.clear();
    }
}
