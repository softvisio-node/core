import sql from "#lib/sql";
import CacheLru from "#lib/cache/lru";
import Mutex from "#lib/threads/mutex";

const SQL = {
    "get": sql`
SELECT
    storage_link.name,
    storage_link.storage_file_id,
    storage_link.last_modified,
    storage_link.content_type,
    storage_link.cache_control,
    storage_link.content_disposition,
    storage_file.size AS content_length,
    storage_file.hash
FROM
    storage_link,
    storage_file
WHERE
    storage_link.storage_file_id = storage_file.id
    AND storage_link.name = ?
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
    async get ( name ) {
        var res = this.#cache.get( name );

        if ( res ) return res;

        const mutex = this.#mutexSet.get( name );

        if ( !mutex.tryDown() ) return mutex.signal.wait();

        res = await this.#dbh.selectRow( SQL.get, [name] );

        if ( !res.data ) return;

        res = this.#onFileUpdate( res.data );

        mutex.signal.broadcast( res );
        mutex.up();

        return res;
    }

    // private
    // XXX date vs last-modified
    #onFileUpdate ( data ) {
        data = {
            "name": data.name,
            "fileId": data.storage_file_id,
            "date": data.last_modified,
            "contentType": data.content_type,
            "cacheControl": data.cache_control,
            "contentDisposition": data.content_disposition,
            "contentLength": data.content_length,
            "etag": data.hash,
            "headers": {
                "date": data.last_modified,
                "etag": data.hash,
            },
        };

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
