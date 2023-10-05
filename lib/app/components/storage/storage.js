import crypto from "node:crypto";
import sql from "#lib/sql";
import Cron from "#lib/cron";
import Mutex from "#lib/threads/mutex";
import Cache from "./storage/cache.js";
import Duration from "#lib/duration";

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

    "getImageIdByHash": sql`SELECT id FROM storage_image WHERE hash = ?`.prepare(),

    "createImage": sql`SELECT storage_create_image( _hash => ?, _size => ? ) AS id`.prepare(),

    "createFile": sql`
SELECT storage_create_file(
    _path => ?,
    _storage_image_id => ?,
    _last_modified => ?,
    _content_type => ?,
    _cache_control => ?,
    _content_disposition => ?,
    _inactive_max_age => ?,
    _expires => ?
) AS id`.prepare(),

    "deleteFileById": sql`DELETE FROM storage_file WHERE id = ?`.prepare(),

    "deleteFileByPath": sql`DELETE FROM storage_file WHERE path = ?`.prepare(),

    "deleteFolder": sql`DELETE FROM storage_file WHERE path LIKE ? ESCAPE '\\'`.prepare(),
};

export default class Storage {
    #app;
    #config;
    #location;
    #locations = {};
    #sortedLocations;
    #dbh;
    #clearCron;
    #isClearing;
    #uploadFileMutexSet = new Mutex.Set();
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
    async configure () {
        const locations = {};

        for ( let location in this.#config.locations ) {
            const config = this.#config.locations[location];

            location = this.#cache.normalizePath( location );

            if ( location === "" ) location = "/";

            if ( locations[location] ) {
                return result( [400, `Storage location "${location}" is already defined`] );
            }

            locations[location] = { ...config };
            locations[location].private ??= true;
        }

        // get components locations
        for ( const component of this.app.components ) {
            if ( component.name === "storage" ) continue;

            const componentLocations = component.storageLocations;

            if ( !componentLocations ) continue;

            for ( let location in componentLocations ) {
                const config = componentLocations[location];

                location = this.#cache.normalizePath( location );

                if ( location === "" ) location = "/";

                if ( locations[location] ) {
                    return result( [400, `Storage location "${location}" is already defined`] );
                }

                locations[location] = { ...config };

                // make location private by default
                locations[location].private ??= true;
            }
        }

        this.#config.locations = locations;

        return result( 200 );
    }

    async init () {
        var res;

        res = await this._init();
        if ( !res.ok ) return res;

        // init db
        res = await this.#dbh.schema.migrate( new URL( "db", import.meta.url ) );
        if ( !res.ok ) return res;

        const publicHttpServer = this.config.listenPublicHttpServer ? this.app.publicHttpServer : null,
            privateHttpServer = this.config.listenPrivateHttpServer ? this.app.privateHttpServer : null;

        for ( var [location, config] of Object.entries( this.config.locations ) ) {
            const httpLocation = this.#cache.normalizePath( this.#location + "/" + location );

            this.#locations[location] = {
                ...config,
                location,
                httpLocation,
            };

            if ( this.#locations[location].maxAge ) {
                this.#locations[location].maxAge = Duration.new( this.#locations[location].maxAge );
            }

            if ( this.#locations[location].inactiveMaxAge ) {
                this.#locations[location].inactiveMaxAge = Duration.new( this.#locations[location].inactiveMaxAge );
            }

            if ( !config.private ) {
                publicHttpServer?.get( httpLocation + "/*", this.#downloadFile.bind( this ) );

                privateHttpServer?.get( httpLocation + "/*", this.#downloadFile.bind( this ) );
            }
            else {
                publicHttpServer?.get( httpLocation + "/*", this.#privateLocation.bind( this ) );

                privateHttpServer?.get( httpLocation + "/*", this.#privateLocation.bind( this ) );
            }
        }

        this.#sortedLocations = Object.keys( this.#locations )
            .filter( location => location !== "/" )
            .sort( ( a, b ) => b.length - a.length );

        return result( 200 );
    }

    async start () {
        this.#clearCron = new Cron( DEFAULT_CLEAR_FILES_CRON ).on( "tick", this.clearStorage.bind( this ) ).unref().start();

        return result( 200 );
    }

    getFileUrl ( path ) {
        return this.#cache.normalizePath( this.location + "/" + path );
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

    async uploadFile ( path, file, { lastModified, contentType, cacheControl, contentDisposition, expires, maxAge, inactiveMaxAge, dbh } = {} ) {
        path = this.#cache.normalizePath( path );

        const location = this.#getLocation( path );

        if ( !location ) return result( [400, `Location is not valid`] );

        if ( maxAge === undefined ) maxAge = location.maxAge;

        if ( inactiveMaxAge ) {
            inactiveMaxAge = Duration.new( inactiveMaxAge );
        }
        else if ( inactiveMaxAge === undefined ) {
            inactiveMaxAge = location.inactiveMaxAge;
        }

        var res;

        // upload image
        res = await this.#uploadImage( file );
        if ( !res.ok ) return res;

        const imageId = res.data.id;

        expires = this.#caclulateExpires( expires, maxAge, inactiveMaxAge );

        dbh ||= this.#dbh;

        // upsert file link
        res = await dbh.selectRow( SQL.createFile, [

            //
            path,
            imageId,
            lastModified || new Date(),
            contentType ?? file.type,
            cacheControl || location.cacheControl,
            contentDisposition,
            inactiveMaxAge?.toString(),
            expires,
        ] );

        if ( !res.ok ) return res;

        return result( 200, {
            "id": res.data.id,
            path,
        } );
    }

    async isFileExists ( path, { dbh } = {} ) {
        const file = await this.#cache.get( path, { "updateExpires": false, dbh } );

        return !!file;
    }

    async getFile ( path, { dbh } = {} ) {
        const file = await this.#cache.get( path, { dbh } );

        if ( !file ) {
            return result( 404 );
        }
        else {
            return this._getFile( file );
        }
    }

    async downloadFile ( req, id, { contentType, cacheControl, contentDisposition, dbh } = {} ) {
        const file = await this.#cache.get( id, { dbh } );

        if ( !file ) {
            return req.end( 404 );
        }
        else {
            const headers = { ...file.headers };

            if ( contentType ) headers["content-type"] = contentType;
            if ( cacheControl ) headers["cache-control"] = cacheControl;
            if ( contentDisposition ) headers["content-disposition"] = contentDisposition;

            return this._downloadFile( req, file.imageId, headers );
        }
    }

    async copyFile ( from, to, { lastModified, cacheControl, contentDisposition, expires, maxAge, inactiveMaxAge, dbh } = {} ) {
        dbh ||= this.#dbh;

        const file = await this.#cache.get( from, { "updateExpires": false, dbh } );

        // source file not found
        if ( !file ) return result( 404 );

        to = this.#cache.normalizePath( to );

        const location = this.#getLocation( to );

        if ( !location ) return result( [400, `Location is not valid`] );

        if ( maxAge === undefined ) maxAge = location.maxAge;

        if ( inactiveMaxAge ) {
            inactiveMaxAge = Duration.new( inactiveMaxAge );
        }
        else if ( inactiveMaxAge === undefined ) {
            inactiveMaxAge = location.inactiveMaxAge;
        }

        expires = this.#caclulateExpires( expires, maxAge, inactiveMaxAge );

        const res = await dbh.selectRow( SQL.createFile, [

            //
            to,
            file.imageId,
            lastModified || new Date(),
            file.contentType,
            cacheControl || location.cacheControl,
            contentDisposition,
            inactiveMaxAge?.toString(),
            expires,
        ] );

        if ( !res.ok ) return res;

        return result( 200, {
            "id": res.data.id,
            "path": to,
        } );
    }

    async deleteFile ( path, { dbh } = {} ) {
        const id = this.#cache.resolveId( path );

        dbh ||= this.#dbh;

        if ( id ) {
            return dbh.do( SQL.deleteFileById, [id] );
        }
        else {
            return dbh.do( SQL.deleteFileByPath, [this.#cache.normalizePath( path )] );
        }
    }

    async deleteFolder ( path, { dbh } = {} ) {
        path = this.#cache.normalizePath( path );

        if ( !path.endsWith( "/" ) ) path += "/";

        dbh ||= this.#dbh;

        return dbh.do( SQL.deleteFolder, [sql.quoteLikePattern( path ) + "%"] );
    }

    // protected
    async _init () {
        return result( 200 );
    }

    // private
    #getLocation ( path ) {
        for ( const location of this.#sortedLocations ) {
            if ( path.startsWith( location + "/" ) ) return this.#locations[location];
        }

        return this.#locations["/"];
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

    async #downloadFile ( req ) {
        const path = req.path.substring( this.#location.length );

        return this.downloadFile( req, path );
    }

    async #privateLocation ( req ) {
        req.end( 403 );
    }

    #caclulateExpires ( expires, maxAge, inactiveMaxAge ) {
        if ( expires && !( expires instanceof Date ) ) expires = new Date( expires );

        if ( maxAge ) {
            const expires1 = Duration.new( maxAge ).toDate();

            if ( !expires || expires1 < expires ) expires = expires1;
        }

        if ( inactiveMaxAge ) {
            const expires1 = Duration.new( inactiveMaxAge ).toDate();

            if ( !expires || expires1 < expires ) expires = expires1;
        }

        return expires;
    }

    async #uploadImage ( file ) {
        const hash = await this.#getHash( file );

        // shared mutex lock
        const sharedMutex = this.app.cluster?.mutexes.get( "storage/upload/" + hash );
        if ( sharedMutex ) await sharedMutex.lock();

        var res;

        const mutex = this.#uploadFileMutexSet.get( hash );

        if ( mutex.tryLock() ) {

            // check image exists
            res = await this.#dbh.selectRow( SQL.getImageIdByHash, [hash] );

            // image is not exists
            if ( res.ok && !res.data ) {

                // insert image
                res = await this.#dbh.begin( async dbh => {
                    const res = await dbh.selectRow( SQL.createImage, [hash, file.size] );

                    if ( !res.ok ) throw res;

                    const uploadFileRes = await this._uploadImage( res.data.id, file );

                    if ( !uploadFileRes.ok ) throw uploadFileRes;

                    return res;
                } );
            }

            mutex.unlock( res );
        }
        else {
            res = await mutex.wait();
        }

        // shared mutex unlock
        sharedMutex?.unlock();

        return res;
    }
}
