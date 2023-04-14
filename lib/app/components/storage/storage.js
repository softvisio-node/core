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

    "dropImageHash": sql`UPDATE storage_image SET hash = NULL WHERE links_count = 0`.prepare(),

    "deleteExpiredFiles": sql`DELETE FROM storage_file WHERE expires <= CURRENT_TIMESTAMP`.prepare(),

    "selectDeletedImages": sql`SELECT id FROM storage_image WHERE hash IS NULL LIMIT ?`.prepare(),

    "getImageIdyHash": sql`SELECT id FROM storage_image WHERE hash = ?`.prepare(),

    "upsertImage": sql`INSERT INTO storage_image ( hash, size ) VALUES ( ?, ? ) ON CONFLICT ( hash ) DO UPDATE SET size = EXCLUDED.size RETURNING id`.prepare(),

    "upsertFile": sql`
INSERT INTO storage_file (
    path,
    storage_image_id,
    last_modified,
    content_type,
    cache_control,
    content_disposition,
    inactive_max_age,
    expires
)
VALUES
    ( ?, ?, ?, ?, ?, ?, ?, ? )
ON CONFLICT ( path ) DO UPDATE SET
    storage_image_id = EXCLUDED.storage_image_id,
    last_modified = EXCLUDED.last_modified,
    content_type = EXCLUDED.content_type,
    cache_control = EXCLUDED.cache_control,
    content_disposition = EXCLUDED.content_disposition,
    inactive_max_age = EXCLUDED.inactive_max_age,
    expires = EXCLUDED.expires
`,

    "deleteFile": sql`DELETE FROM storage_file WHERE path = ?`.prepare(),

    "deleteFolder": sql`DELETE FROM storage_file WHERE path LIKE ? ESCAPE '\\'`.prepare(),
};

export default class Storage {
    #app;
    #config;
    #location;
    #dbh;
    #clearCron;
    #isClearing;
    #uploadFileMutexSet = new Mutex.Set( { "destroyOnFinish": true } );
    #cache;

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;
        this.#location = config.location;
        this.#dbh = app.dbh;

        this.#cache = new Cache( app.dbh, config.maxCacheSize );
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
    async init () {
        var res;

        res = await this._init();
        if ( !res.ok ) return res;

        // init db
        res = await this.#dbh.schema.migrate( new URL( "db", import.meta.url ) );
        if ( !res.ok ) return res;

        const publicHttpServer = this.config.listenPublicHttpServer ? this.app.publicHttpServer : null,
            privateHttpServer = this.config.listenPrivateHttpServer ? this.app.privateHttpServer : null;

        const privaPaths = new Set( this.config.privaPaths );

        if ( privaPaths.has( "/" ) ) {
            for ( const server of [publicHttpServer, privateHttpServer] ) {
                if ( !server ) continue;

                server.get( `${this.#location}/*`, this.#privateLocation.bind( this ) );
                server.head( `${this.#location}/*`, this.#privateLocation.bind( this ) );
            }
        }
        else {
            for ( const server of [publicHttpServer, privateHttpServer] ) {
                if ( !server ) continue;

                server.get( `${this.#location}/*`, this.downloadFile.bind( this ) );
                server.head( `${this.#location}/*`, this.downloadFile.bind( this ) );

                for ( const privaPath of privaPaths ) {
                    server.get( `${this.#location}${privaPath}/*`, this.#privateLocation.bind( this ) );
                    server.head( `${this.#location}${privaPath}/*`, this.#privateLocation.bind( this ) );
                }
            }
        }

        return result( 200 );
    }

    async run () {
        this.#clearCron = new Cron( DEFAULT_CLEAR_FILES_CRON ).on( "tick", this.clearStorage.bind( this ) ).unref().start();

        return result( 200 );
    }

    getFileUrl ( path ) {
        return this.location + this.#normalizePath( path );
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

            res = await dbh.do( SQL.deleteExpiredFiles );
            res = await dbh.do( SQL.dropImageHash );

            while ( true ) {
                const files = await dbh.select( SQL.selectDeletedImages, [DEFAULT_CLEAR_FILES_LIMIT] );

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

    // maxAge: seconds
    // inactiveMaxAge: seconds
    async uploadFile ( path, file, { lastModified, contentType, cacheControl, contentDisposition, expires, maxAge, inactiveMaxAge } = {} ) {
        const hash = await this.#getHash( file );

        var res;

        const mutex = this.#uploadFileMutexSet.get( hash );

        if ( mutex.tryDown() ) {
            res = await this.#dbh.selectRow( SQL.getImageIdyHash, [hash] );

            if ( res.ok && !res.data ) {
                res = await this.#dbh.begin( async dbh => {
                    const res = await dbh.selectRow( SQL.upsertImage, [hash, file.size] );

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

        if ( expires && !( expires instanceof Date ) ) expires = new Date( expires );

        if ( maxAge ) {
            const expires1 = new Date( Date.now() + maxAge * 1000 );

            if ( !expires || expires1 < expires ) expires = expires1;
        }

        if ( inactiveMaxAge ) {
            const expires1 = new Date( Date.now() + inactiveMaxAge * 1000 );

            if ( !expires || expires1 < expires ) expires = expires1;
        }

        // upsert file link
        return this.#dbh.do( SQL.upsertFile, [this.#normalizePath( path ), imageId, lastModified || new Date(), contentType, cacheControl, contentDisposition, inactiveMaxAge, expires] );
    }

    async downloadFile ( req, { path } = {} ) {
        if ( path ) {
            path = this.#normalizePath( path );
        }
        else {
            path = req.path.substring( this.#location.length );
        }

        const file = await this.#cache.get( path );

        if ( !file ) {
            return req.end( 404 );
        }
        else {
            return this._downloadFile( req, file );
        }
    }

    async deleteFile ( path ) {
        return this.#dbh.do( SQL.deleteFile, [this.#normalizePath( path )] );
    }

    async deleteFolder ( path ) {
        path = this.#normalizePath( path );

        if ( !path.endsWith( "/" ) ) path += "/";

        return this.#dbh.do( SQL.deleteFolder, [sql.quoteLikePattern( path ) + "%"] );
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

    async #privateLocation ( req ) {
        req.end( 403 );
    }
}
