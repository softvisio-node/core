import sql from "#lib/sql";
import CacheLru from "#lib/cache/lru";
import Mutex from "#lib/threads/mutex";
import StorageFile from "./file.js";

const SQL = {
    "get": sql`
SELECT
    storage_file.path,
    storage_file.storage_image_id,
    storage_file.last_modified,
    storage_file.content_type,
    storage_file.cache_control,
    storage_file.content_disposition,
    storage_file.inactive_max_age,
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

    "updateFileExpires": sql`UPDATE storage_file SET expires = ? WHERE id = ?`.prepare(),
};

export default class {
    #dbh;
    #cache;
    #mutexSet = new Mutex.Set();

    constructor ( dbh, maxSize ) {
        this.#dbh = dbh;
        this.#cache = new CacheLru( { maxSize } );

        dbh.on( "storage/link/update", this.#onFileUpdate.bind( this ) );

        dbh.on( "storage/link/delete", this.#onFileDelete.bind( this ) );

        dbh.on( "disconnect", this.#onDisconnect.bind( this ) );
    }

    // public
    async get ( path, updateMaxAge = true ) {
        var file = this.#cache.get( path );

        if ( file ) {

            // file is expired
            if ( file.expires && file.expires <= new Date() ) {
                this.#cache.delete( path );

                return;
            }

            if ( !file?.inactiveMaxAge ) return file;
        }

        const mutex = this.#mutexSet.get( "get/" + path );

        if ( !mutex.tryLock() ) return mutex.wait();

        if ( !file ) {
            const res = await this.#dbh.selectRow( SQL.get, [path] );

            if ( res.data ) {
                file = this.#onFileUpdate( res.data );
            }
        }

        if ( updateMaxAge && file?.inactiveMaxAge ) {
            file.setExpires( new Date( Date.now() + file.inactiveMaxAge ) );

            await this.#dbh.do( SQL.updateFileExpires, [file.expires, file.id] );
        }

        mutex.unlock( file );

        return file;
    }

    delete ( path ) {
        this.#onFileDelete( { path } );
    }

    // private
    #onFileUpdate ( data ) {
        if ( data.expires ) {
            data.expires = new Date( data.expires );

            if ( data.expires <= new Date() ) {
                this.#cache.delete( data.path );

                return;
            }
        }

        const file = new StorageFile( data );

        this.#cache.set( file.path, file );

        return data;
    }

    #onFileDelete ( data ) {
        this.#cache.delete( data.path );
    }

    #onDisconnect () {
        this.#cache.clear();
    }
}
