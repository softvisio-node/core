import crypto from "node:crypto";
import sql from "#lib/sql";
import Cron from "#lib/cron";
import Mutex from "#lib/threads/mutex";
import Cache from "./storage/cache.js";
import Duration from "#lib/duration";
import path from "node:path";

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

    "createFile": sql`SELECT storage_create_file(
    _path => ?,
    _storage_image_id => ?,
    _last_modified => ?,
    _content_type => ?,
    _cache_control => ?,
    _content_disposition => ?,
    _inactive_max_age => ?,
    _expires => ?
)`.prepare(),

    "createImage": sql`SELECT storage_create_image( _hash => ?, _size => ? )`.prepare(),

    "deleteFile": sql`DELETE FROM storage_file WHERE path = ?`.prepare(),

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

            location = this.#normalizePath( location );

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

                location = this.#normalizePath( location );

                if ( location === "" ) location = "/";

                if ( locations[location] ) {
                    return result( [400, `Storage location "${location}" is already defined`] );
                }

                locations[location] = { ...config };
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
            const httpLocation = this.#normalizePath( this.#location + "/" + location );

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
                publicHttpServer?.get( httpLocation + "/*", this.downloadFile.bind( this ) );

                privateHttpServer?.get( httpLocation + "/*", this.downloadFile.bind( this ) );
            }
            else {
                publicHttpServer?.get( httpLocation + "/*", this.#privateLocation.bind( this ) );

                privateHttpServer?.get( httpLocation + "/*", this.#privateLocation.bind( this ) );
            }
        }

        this.sortedLocations = Object.keys( this.#locations ).sort( ( a, b ) => b.length - a.length );

        return result( 200 );
    }

    async start () {
        this.#clearCron = new Cron( DEFAULT_CLEAR_FILES_CRON ).on( "tick", this.clearStorage.bind( this ) ).unref().start();

        return result( 200 );
    }

    getFileUrl ( path ) {
        return this.#normalizePath( this.location + "/" + path );
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

    // XXX transaction
    async uploadFile ( path, file, { lastModified, contentType, cacheControl, contentDisposition, expires, maxAge, inactiveMaxAge, callback } = {} ) {
        path = this.#normalizePath( path );

        const location = this.#getLocation( path );

        if ( !location ) return result( [400, `Location is not valid`] );

        if ( maxAge === undefined ) maxAge = location.maxAge;
        if ( inactiveMaxAge === undefined ) inactiveMaxAge = location.inactiveMaxAge;

        const hash = await this.#getHash( file );

        // shared mutex lock
        const sharedMutex = this.app.cluster?.mutexes.get( "storage/upload/" + hash );
        if ( sharedMutex ) await sharedMutex.lock();

        var res;

        const mutex = this.#uploadFileMutexSet.get( hash );

        if ( mutex.tryLock() ) {
            res = await this.#dbh.selectRow( SQL.getImageIdByHash, [hash] );

            if ( res.ok && !res.data ) {
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

        if ( !res.ok ) return res;

        const imageId = res.data.id;

        if ( expires && !( expires instanceof Date ) ) expires = new Date( expires );

        if ( maxAge ) {
            const expires1 = Duration.new( maxAge ).toDate();

            if ( !expires || expires1 < expires ) expires = expires1;
        }

        if ( inactiveMaxAge ) {
            inactiveMaxAge = Duration.new( inactiveMaxAge );

            const expires1 = inactiveMaxAge.toDate();

            if ( !expires || expires1 < expires ) expires = expires1;
        }

        // create link in transaction
        if ( callback ) {
            return this.#dbh.begin( async dbh => {
                var res = await dbh.selectRow( SQL.createFile, [

                    //
                    path,
                    imageId,
                    lastModified || new Date(),
                    contentType ?? file.type,
                    cacheControl,
                    contentDisposition,
                    inactiveMaxAge?.toString(),
                    expires,
                ] );

                if ( !res.ok ) throw res;

                return callback( dbh, res.data );
            } );
        }

        // upsert file link
        else {
            return this.#dbh.selectRow( SQL.createFile, [

                //
                path,
                imageId,
                lastModified || new Date(),
                contentType ?? file.type,
                cacheControl,
                contentDisposition,
                inactiveMaxAge?.toString(),
                expires,
            ] );
        }
    }

    // XXX id or path
    async isFileExists ( path ) {
        path = this.#normalizePath( path );

        const file = await this.#cache.get( path, false );

        return !!file;
    }

    // XXX id or path
    async getFile ( path ) {
        path = this.#normalizePath( path );

        const file = await this.#cache.get( path );

        if ( !file ) {
            return result( 404 );
        }
        else {
            return this._getFile( file );
        }
    }

    // XXX id or path
    async downloadFile ( req, { path, contentType, cacheControl, contentDisposition } = {} ) {
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
            const headers = { ...file.headers };

            if ( contentType ) headers["content-type"] = contentType;
            if ( cacheControl ) headers["cache-control"] = cacheControl;
            if ( contentDisposition ) headers["content-disposition"] = contentDisposition;

            return this._downloadFile( req, file.imageId, headers );
        }
    }

    // XXX
    async copyFile ( from, to, { cacheControl, contentDisposition, expires, maxAge, inactiveMaxAge, dbh } = {} ) {
        from = this.#normalizePath( from );
        to = this.#normalizePath( to );

        const file = await this.#cache.get( from, false );

        dbh ||= this.dbh;

        // source file not found
        if ( !file ) return result( 404 );

        await dbh.do( sql`SELECT * FROM storage_create_file( _path, _storage_image_id, _last_modified, _content_type, _cache_control, _content_disposition, _inactive_max_age, _expites )`, [] );
    }

    // XXX id or path
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
    #normalizePath ( location ) {
        location = path.posix.join( "/", location );

        if ( location.endsWith( "/" ) ) location = location.substring( 0, location.length - 1 );

        return location;
    }

    #getLocation ( path ) {
        for ( const location of this.sortedLocations ) {
            if ( path.startsWith( location + "/" ) ) return this.#locations[location];
        }
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
