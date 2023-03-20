import sql from "#lib/sql";
import CacheLru from "#lib/cache/lru";

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

    constructor ( dbh, maxSize ) {
        this.#dbh = dbh;
        this.#cache = new CacheLru( { maxSize } );

        dbh.on( "storage/link/update", this.#onLinkUpdate.bind( this ) );

        dbh.on( "storage/link/delete", this.#onLinkDelete.bind( this ) );

        dbh.on( "disconnect", this.#onDisconnect.bind( this ) );
    }

    // public
    // XXX mutex
    async get ( name ) {
        var res = this.#cache.get( name );

        if ( res ) return res;

        res = await this.#dbh.selectRow( SQL.get, [name] );

        if ( !res.data ) return;

        return this.#onLinkDelete( res.data );
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
