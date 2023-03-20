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

        dbh.on( "storage/link/update", this.#onLinkUpdate.bind( this ) );

        dbh.on( "storage/link/delete", this.#onLinkDelete.bind( this ) );

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

        res = this.#onLinkDelete( res.data );

        mutex.broadcast( res );
        mutex.up();

        return res;
    }

    // private
    // XXX etag, convert headers names
    #onLinkUpdate ( data ) {
        this.#cache.set( data.name, data );
    }

    #onLinkDelete ( data ) {
        this.#cache.delete( data.name );

        return data;
    }

    #onDisconnect () {
        this.#cache.clear();
    }
}
