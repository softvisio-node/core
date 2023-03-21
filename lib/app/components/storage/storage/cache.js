import sql from "#lib/sql";
import CacheLru from "#lib/cache/lru";
import Mutex from "#lib/threads/mutex";

const SQL = {
    "get": sql`
SELECT
    storage_file.name,
    storage_file.storage_image_id,
    storage_file.last_modified,
    storage_file.content_type,
    storage_file.cache_control,
    storage_file.content_disposition,
    storage_image.size AS content_length,
    storage_image.hash
FROM
    storage_file,
    storage_image
WHERE
    storage_file.storage_image_id = storage_image.id
    AND storage_file.name = ?
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
        var res = this.#cache.get( name );

        if ( res ) return res;

        const mutex = this.#mutexSet.get( path );

        if ( !mutex.tryDown() ) return mutex.signal.wait();

        res = await this.#dbh.selectRow( SQL.get, [path] );

        if ( !res.data ) return;

        res = this.#onFileUpdate( res.data );

        mutex.signal.broadcast( res );
        mutex.up();

        return res;
    }

    delete ( path ) {
        this.#onFileDelete( { path } );
    }

    // private
    #onFileUpdate ( data ) {
        data = {
            "name": data.name,
            "imageId": data.storage_image_id,
            "lastModified": new Date( data.last_modified ),
            "contentType": data.content_type,
            "cacheControl": data.cache_control,
            "contentDisposition": data.content_disposition,
            "contentLength": data.content_length,
            "etag": data.hash,
            "headers": {
                "etag": data.hash,
            },
        };

        data.headers["last-modified"] = data.lastModified.toUTCString();

        if ( data.contentType ) data.headers["content-type"] = data.contentType;
        if ( data.cacheControl ) data.headers["cache-control"] = data.cacheControl;
        if ( data.contentDisposition ) data.headers["content-disposition"] = data.contentDisposition;

        this.#cache.set( data.name, data );

        return data;
    }

    #onFileDelete ( data ) {
        this.#cache.delete( data.name );
    }

    #onDisconnect () {
        this.#cache.clear();
    }
}
