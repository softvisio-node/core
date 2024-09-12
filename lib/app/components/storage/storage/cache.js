import sql from "#lib/sql";
import CacheLru from "#lib/cache/lru";
import Mutex from "#lib/threads/mutex";
import StorageFile from "./file.js";
import path from "node:path";

const SQL = {
    "getById": sql`
SELECT
    storage_file.id,
    storage_file.path,
    storage_file.storage_image_id,
    storage_file.last_modified,
    storage_file.content_type,
    storage_file.cache_control,
    storage_file.content_disposition,
    storage_file.inactive_max_age,
    storage_file.expires,

    storage_image.path AS image_path,
    storage_image.hash,
    storage_image.size,
    storage_image.encrypted
FROM
    storage_file,
    storage_image
WHERE
    storage_file.id = ?
    AND storage_file.storage_image_id = storage_image.id
    AND ( storage_file.expires IS NULL OR storage_file.expires > CURRENT_TIMESTAMP )
`.prepare(),

    "getByPath": sql`
SELECT
    storage_file.id,
    storage_file.path,
    storage_file.storage_image_id,
    storage_file.last_modified,
    storage_file.content_type,
    storage_file.cache_control,
    storage_file.content_disposition,
    storage_file.inactive_max_age,
    storage_file.expires,

    storage_image.path AS image_path,
    storage_image.hash,
    storage_image.size,
    storage_image.encrypted
FROM
    storage_file,
    storage_image
WHERE
    storage_file.path = ?
    AND storage_file.storage_image_id = storage_image.id
    AND ( storage_file.expires IS NULL OR storage_file.expires > CURRENT_TIMESTAMP )
`.prepare(),

    "updateFileExpires": sql`UPDATE storage_file SET expires = ? WHERE id = ?`.prepare(),
};

export default class {
    #storage;
    #dbh;
    #cache;
    #filePathId = {};
    #mutexSet = new Mutex.Set();

    constructor ( storage, maxSize ) {
        this.#storage = storage;
        this.#dbh = storage.app.dbh;
        this.#cache = new CacheLru( { maxSize } );

        this.#cache.on( "delete", ( id, file ) => delete this.#filePathId[ file.path ] );

        this.#dbh.on( "storage/file/update", this.#onFileUpdate.bind( this ) );

        this.#dbh.on( "storage/file/delete", this.#onFileDelete.bind( this ) );

        this.#dbh.on( "disconnect", this.#onDisconnect.bind( this ) );
    }

    // properties
    get storage () {
        return this.#storage;
    }

    // public
    async get ( filePath, { cwd, updateExpires = true, dbh } = {} ) {
        var fileId;

        if ( !cwd && this.isFileId( filePath ) ) {
            fileId = filePath;
        }
        else {
            filePath = this.normalizePath( filePath, { cwd } );

            fileId = this.#filePathId[ filePath ];
        }

        var file;

        if ( fileId ) {
            this.#cache.get( fileId );
        }

        if ( file ) {

            // file is expired
            if ( file.expires && file.expires <= new Date() ) {
                this.#cache.delete( filePath );

                return;
            }

            if ( !file.inactiveMaxAge ) return file;
        }

        const mutex = this.#mutexSet.get( "get/" + filePath );

        if ( !mutex.tryLock() ) return mutex.wait();

        dbh ||= this.#dbh;

        if ( !file ) {
            let res;

            if ( fileId ) {
                res = await dbh.selectRow( SQL.getById, [ fileId ] );
            }
            else {
                res = await dbh.selectRow( SQL.getByPath, [ filePath ] );
            }

            if ( res.data ) {
                file = this.#onFileUpdate( res.data );
            }
        }

        if ( updateExpires && file?.inactiveMaxAge ) {
            file.setExpires( file.inactiveMaxAge.toDate() );

            await dbh.do( SQL.updateFileExpires, [ file.expires, file.id ] );
        }

        mutex.unlock( file );

        return file;
    }

    delete ( filePath, { cwd } = {} ) {
        var fileId;

        if ( !cwd && this.isFileId( filePath ) ) {
            fileId = filePath;
        }
        else {
            filePath = this.normalizePath( filePath, { cwd } );

            fileId = this.#filePathId[ filePath ];
        }

        if ( fileId ) this.#cache.delete( fileId );
    }

    isFileId ( fileId ) {
        try {
            fileId = BigInt( fileId ).toString();

            if ( fileId === "0" ) return false;

            return true;
        }
        catch {
            return false;
        }
    }

    normalizePath ( filePath, { cwd } = {} ) {
        filePath = path.posix.join( "/", cwd || "", filePath );

        if ( filePath !== "/" && filePath.endsWith( "/" ) ) filePath = filePath.slice( 0, -1 );

        return filePath;
    }

    // private
    #onFileUpdate ( fields ) {
        if ( fields.expires ) {
            fields.expires = new Date( fields.expires );

            if ( fields.expires <= new Date() ) {
                this.#cache.delete( fields.id );

                return;
            }
        }

        const file = new StorageFile( this, fields );

        this.#cache.set( file.id, file );
        this.#filePathId[ file.path ] = file.id;

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
