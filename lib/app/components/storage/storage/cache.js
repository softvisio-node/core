import sql from "#lib/sql";
import CacheLru from "#lib/cache/lru";
import Mutex from "#lib/threads/mutex";
import StorageFile from "./file.js";

const SQL = {
    "getById": sql`
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
    AND storage_file.id = ?
    AND ( storage_file.expires IS NULL OR storage_file.expires > CURRENT_TIMESTAMP )
`.prepare(),

    "getByPath": sql`
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
    #filePathId = {};
    #mutexSet = new Mutex.Set();

    constructor ( dbh, maxSize ) {
        this.#dbh = dbh;
        this.#cache = new CacheLru( { maxSize } );

        this.#cache.on( "delete", ( id, file ) => delete this.#filePathId[file.path] );

        dbh.on( "storage/link/update", this.#onFileUpdate.bind( this ) );

        dbh.on( "storage/link/delete", this.#onFileDelete.bind( this ) );

        dbh.on( "disconnect", this.#onDisconnect.bind( this ) );
    }

    // public
    async get ( path, { updateExpires = true, dbh } = {} ) {
        const id = this.#resolveId( path );

        var file;

        if ( id ) {
            this.#cache.get( id );
        }

        if ( file ) {

            // file is expired
            if ( file.expires && file.expires <= new Date() ) {
                this.#cache.delete( path );

                return;
            }

            if ( !file.inactiveMaxAge ) return file;
        }

        const mutex = this.#mutexSet.get( "get/" + path );

        if ( !mutex.tryLock() ) return mutex.wait();

        dbh ||= this.#dbh;

        if ( !file ) {
            let res;

            if ( id ) {
                res = await dbh.selectRow( SQL.getById, [id] );
            }
            else {
                res = await dbh.selectRow( SQL.getByPath, [path] );
            }

            if ( res.data ) {
                file = this.#onFileUpdate( res.data );
            }
        }

        if ( updateExpires && file?.inactiveMaxAge ) {
            file.setExpires( file.inactiveMaxAge.toDate() );

            await dbh.do( SQL.updateFileExpires, [file.expires, file.id] );
        }

        mutex.unlock( file );

        return file;
    }

    delete ( path ) {
        const id = this.#resolveId( path );

        if ( id ) this.#cache.delete( id );
    }

    // private
    #resolveId ( path ) {
        var id;

        try {
            id = BigInt( path ).toString();
        }
        catch ( e ) {
            id = this.#filePathId[path];
        }

        return id;
    }

    #onFileUpdate ( fields ) {
        if ( fields.expires ) {
            fields.expires = new Date( fields.expires );

            if ( fields.expires <= new Date() ) {
                this.#cache.delete( fields.id );

                return;
            }
        }

        const file = new StorageFile( fields );

        this.#cache.set( file.id, file );
        this.#filePathId[file.path] = file.id;

        return file;
    }

    #onFileDelete ( data ) {
        this.#cache.delete( data.id );
    }

    #onDisconnect () {
        this.#cache.clear( { "silent": true } );
        this.#filePathId = {};
    }
}
