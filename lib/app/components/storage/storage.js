import crypto from "node:crypto";
import sql from "#lib/sql";
import Cron from "#lib/cron";
import Mutex from "#lib/threads/mutex";
import Cache from "./storage/cache.js";

const HASH_ALGORYTM = "SHA3-512",
    HASH_ENCODING = "base64url";

const DEFAULT_CLEAR_FILES_LIMIT = 100,
    DEFAULT_CLEAR_FILES_CRON = "0 * * * *";

const SQL = {
    "lock": sql`SELECT pg_try_advisory_lock( get_lock_id( 'storage/clear' ) ) AS locked`.prepare(),

    "unlock": sql`SELECT pg_advisory_unlock( get_lock_id( 'storage/clear' ) )`.prepare(),

    "dropFileHash": sql`UPDATE storage_image SET hash = NULL WHERE links_count = 0`.prepare(),

    "selectDeletedFiles": sql`SELECT id FROM storage_image WHERE hash IS NULL LIMIT ?`.prepare(),

    "getFileIdyHash": sql`SELECT id FROM storage_image WHERE hash = ?`.prepare(),

    "upsertFile": sql`INSERT INTO storage_image ( hash, size ) VALUES ( ?, ? ) ON CONFLICT ( hash ) DO UPDATE SET size = EXCLUDED.size RETURNING id`.prepare(),

    "upsertLink": sql`
INSERT INTO storage_file
    ( path, storage_image_id, last_modified, content_type, cache_control, content_disposition )
    VALUES
    ( ?, ?, ?, ?, ?, ? )
ON CONFLICT ( path ) DO UPDATE SET
    storage_image_id = EXCLUDED.storage_image_id,
    last_modified = EXCLUDED.last_modified,
    content_type = EXCLUDED.content_type,
    cache_control = EXCLUDED.cache_control,
    content_disposition = EXCLUDED.content_disposition
`,

    "deleteFile": sql`DELETE FROM storage_file WHERE path = ?`.prepare(),

    "deleteFolder": sql`DELETE FROM storage_file WHERE path LIKE ?`.prepare(),
};

export default class Storage {
    #app;
    #config;
    #location;
    #dbh;
    #clearCron;
    #shutdownSignal;
    #isClearing;
    #uploadFileMutexSet = new Mutex.Set( { "destroyOnFinish": true } );
    #cache;

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;
        this.#location = config.location;
        this.#dbh = app.dbh;

        this.#cache = new Cache( app.dbh, config.maxCacheSize );

        this.#shutdownSignal = global.shutdown.signal( "file cache" ).on( "shutdown", this.#shutdown.bind( this ) );
    }

    // properties
    get app () {
        return this.#app;
    }

    get config () {
        return this.#config;
    }

    get location () {
        return this.#location;
    }

    // public
    getFileUrl ( path ) {
        return this.location + "/" + path;
    }

    async init () {
        var res;

        res = await this._init();
        if ( !res.ok ) return res;

        // init db
        res = await this.#dbh.schema.migrate( new URL( "db", import.meta.url ) );
        if ( !res.ok ) return res;

        return result( 200 );
    }

    async run () {
        this.#clearCron = new Cron( DEFAULT_CLEAR_FILES_CRON ).on( "tick", this.clearStorage.bind( this ) ).unref().start();

        this.app.publicHttpServer.get( `${this.#location}/*`, this.downloadFile.bind( this ) );

        return result( 200 );
    }

    async clearStorage () {
        if ( this.#isClearing ) return;

        this.#isClearing = true;

        await this.#dbh.lock( async dbh => {
            var res;

            // lock
            res = await dbh.selectRow( SQL.lock );
            if ( !res.ok ) throw res;

            // not locked
            if ( !res.data.locked ) return;

            res = await dbh.do( SQL.dropFileHash );

            while ( true ) {
                const files = await dbh.select( SQL.selectDeletedFiles, [DEFAULT_CLEAR_FILES_LIMIT] );

                if ( !files.data ) break;

                const deletedFiles = [];

                for ( const file of files.data ) {
                    const res = await this._deleteImage( file.id );

                    // error deleting file
                    if ( !res.ok ) break;

                    deletedFiles.push( file.id );
                }

                if ( deletedFiles.length ) {
                    await dbh.do( sql`DELETE FROM storage_image WHERE id`.IN( deletedFiles ) );
                }
            }

            // unlock
            res = await dbh.selectRow( SQL.unlock );
            if ( !res.ok ) throw res;
        } );

        this.#isClearing = false;
    }

    async uploadFile ( path, file, { lastModified, contentType, cacheControl, contentDisposition } = {} ) {
        const hash = await this.#getHash( file );

        var res;

        const mutex = this.#uploadFileMutexSet.get( hash );

        if ( mutex.tryDown() ) {
            res = await this.#dbh.selectRow( SQL.getFileIdyHash, [hash] );

            if ( res.ok && !res.data ) {
                res = await this.#dbh.begin( async dbh => {
                    const res = await dbh.selectRow( SQL.upsertFile, [hash, file.size] );

                    if ( !res.ok ) throw res;

                    const uploadFileRes = await this._uploadImage( res.data.id, file );

                    if ( !uploadFileRes.ok ) throw uploadFileRes;

                    return res;
                } );
            }

            mutex.signal.broadcast( res );
            mutex.up();
        }
        else {
            res = await mutex.signal.wait();
        }

        if ( !res.ok ) return res;

        const imageId = res.data.id;

        // upsert file link
        return this.#dbh.do( SQL.upsertLink, [this.#normalizePath( path ), imageId, lastModified || new Date(), contentType, cacheControl, contentDisposition] );
    }

    // XXX
    async downloadFile ( req, { path } = {} ) {
        if ( path ) {
            path = this.#normalizePath( path );
        }
        else {
            path = req.path.substring( this.#location.length );
        }

        const file = await this.#cache.get( path );

        if ( !file ) return req.end( 404 );

        return this._downloadFile( req, file );
    }

    async deleteFile ( path ) {
        return this.#dbh.do( SQL.deleteFile, [this.#normalizePath( path )] );
    }

    async deleteFolder ( path ) {
        path = this.#normalizePath( path );

        if ( !path.endsWith( "/" ) ) path += "/";

        // escape metachars
        path = path.replaceAll( "_", "\\_" ).replaceAll( "%", "\\%" );

        path += "%";

        return this.#dbh.do( SQL.deleteFolder, [path] );
    }

    // protected
    async _init () {
        return result( 200 );
    }

    // private
    #normalizePath ( path ) {
        if ( !path.startsWith( "/" ) ) path = "/" + path;

        return path;
    }

    async #getHash ( file ) {
        return new Promise( resolve => {
            const hash = crypto
                .createHash( HASH_ALGORYTM )
                .setEncoding( HASH_ENCODING )
                .on( "finish", () => resolve( hash.read() ) );

            file.stream().pipe( hash );
        } );
    }

    // XXX
    async #shutdown ( graceful ) {
        this.#shutdownSignal.done();
    }
}
