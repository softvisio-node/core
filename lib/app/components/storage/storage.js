import crypto from "node:crypto";
import sql from "#lib/sql";
import Mutex from "#lib/threads/mutex";
import Cache from "./storage/cache.js";
import Interval from "#lib/interval";
import ThreadsPool from "#lib/threads/pool";
import Counter from "#lib/threads/counter";
import Locations from "./storage/locations.js";
import Buckets from "./storage/buckets.js";

const DELETE_IMAGES_LIMIT = 100,
    CLEAR_MAX_THREADS = 10,
    HASH_ALGORYTM = "SHA256",
    HASH_ENCODING = "base64url";

const SQL = {
    "deleteExpiredFiles": sql`DELETE FROM storage_file WHERE expires <= CURRENT_TIMESTAMP`.prepare(),

    "selectDeletedImage": sql`SELECT path FROM storage_image WHERE links_count = 0 LIMIT ?`.prepare(),

    "createImage": sql`
SELECT storage_create_image(
    _path => ?,
    _hash => ?,
    _size => ?,
    _encrypted => ?
) AS id
`.prepare(),

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
) AS id;
`.prepare(),

    "deleteFileById": sql`DELETE FROM storage_file WHERE id = ?`.prepare(),

    "deleteFileByPath": sql`DELETE FROM storage_file WHERE path = ?`.prepare(),

    "getImageLinksCount": sql`SELECT links_count FROM storage_image WHERE path = ?`.prepare(),

    "deleteImage": sql`DELETE FROM storage_image WHERE path = ?`.prepare(),
};

export default class Storage {
    #app;
    #config;
    #buckets;
    #locations;
    #clearTimeout;
    #clearInterval;
    #mutexSet = new Mutex.Set();
    #cache;
    #deleteImagesThreads = new ThreadsPool( {
        "maxRunningThreads": CLEAR_MAX_THREADS,
        "maxWaitingThreads": Infinity,
    } );

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;

        this.#cache = new Cache( this, config.maxCacheSize );
        this.#clearInterval = new Interval( this.#config.clearInterval );
    }

    // properties
    get app () {
        return this.#app;
    }

    get config () {
        return this.#config;
    }

    get dbh () {
        return this.#app.dbh;
    }

    get buckets () {
        return this.#buckets;
    }

    get locations () {
        return this.#locations;
    }

    // public
    async configure () {
        const locations = {};

        for ( let location in this.#config.locations ) {
            const config = this.#config.locations[ location ];

            location = this.#cache.normalizePath( location );

            if ( locations[ location ] ) {
                return result( [ 400, `Storage location "${ location }" is already defined` ] );
            }

            locations[ location ] = config;
        }

        // get components locations
        for ( const component of this.app.components ) {
            if ( component.id === "storage" ) continue;

            const componentLocations = component.storageLocationsConfig;

            if ( !componentLocations ) continue;

            for ( let location in componentLocations ) {
                const config = componentLocations[ location ];

                location = this.#cache.normalizePath( location );

                if ( locations[ location ] ) {
                    return result( [ 400, `Storage location "${ location }" is already defined` ] );
                }

                locations[ location ] = config;
            }
        }

        this.#config.locations = locations;

        return result( 200 );
    }

    async init () {
        var res;

        // init db
        res = await this.dbh.schema.migrate( new URL( "db", import.meta.url ) );
        if ( !res.ok ) return res;

        // init buckets
        this.#buckets = new Buckets( this );

        res = await this.#buckets.init( this.config.buckets );
        if ( !res.ok ) return res;

        // init locations
        this.#locations = new Locations( this );

        res = await this.#locations.init( this.config.locations );
        if ( !res.ok ) return res;

        // init http locations
        const publicHttpServer = this.config.listenPublicHttpServer
                ? this.app.publicHttpServer
                : null,
            privateHttpServer = this.config.listenPrivateHttpServer
                ? this.app.privateHttpServer
                : null;

        for ( const location of this.#locations ) {
            const httpLocation = this.#cache.normalizePath( this.config.location + "/" + location.location + "/*" );

            if ( !location.isPrivate ) {
                publicHttpServer?.get( httpLocation, this.#downloadFile.bind( this ) );

                privateHttpServer?.get( httpLocation, this.#downloadFile.bind( this ) );
            }
            else {
                publicHttpServer?.get( httpLocation, this.#privateLocation.bind( this ) );

                privateHttpServer?.get( httpLocation, this.#privateLocation.bind( this ) );
            }
        }

        return result( 200 );
    }

    async start () {
        this.clear();

        return result( 200 );
    }

    getFileUrl ( filePath, { cwd } = {} ) {
        return this.#cache.normalizePath( filePath, { "cwd": this.config.location + "/" + ( cwd || "" ) } );
    }

    async clear () {
        clearTimeout( this.#clearTimeout );

        const mutex = this.#getClearMutex();

        // locked
        if ( await mutex.tryLock() ) {
            while ( true ) {

                // delete expired files
                await this.dbh.do( SQL.deleteExpiredFiles );

                // get images to delete
                const images = await this.dbh.select( SQL.selectDeletedImage, [ DELETE_IMAGES_LIMIT ] );

                // no images to delete
                if ( !images.data ) break;

                const counter = new Counter();

                // delete images
                for ( const image of images.data ) {
                    counter.value++;

                    this.#deleteImagesThreads.runThread( this.#deleteImage.bind( this, image.path ) ).then( () => counter.value-- );
                }

                await counter.wait();
            }

            await mutex.unlock();
        }

        clearTimeout( this.#clearTimeout );

        this.#clearTimeout = setTimeout( this.clear.bind( this ), this.#clearInterval.toMilliseconds() );
    }

    async uploadFile ( filePath, file, { cwd, lastModified, contentType, cacheControl, contentDisposition, expires, maxAge, inactiveMaxAge, encrypt, dbh } = {} ) {

        // check path is valid
        if ( /[":<>?\\|]/.test( filePath ) ) return result( [ 400, `Path is not valid` ] );

        filePath = this.#cache.normalizePath( filePath, { cwd } );

        const location = this.#locations.getLocation( filePath ),
            bucket = location.bucket,
            hash = await this.#getHash( file );

        // encrypt
        encrypt = !!( encrypt ?? location.encrypt );
        if ( encrypt && !this.app.crypto ) return result( [ 400, `Unable to encrypt file` ] );

        const imagePath = location.createImagePath( filePath, hash, encrypt );

        if ( maxAge === undefined ) maxAge = location.maxAge;

        if ( inactiveMaxAge ) {
            inactiveMaxAge = Interval.new( inactiveMaxAge );
        }
        else if ( inactiveMaxAge === undefined ) {
            inactiveMaxAge = location.inactiveMaxAge;
        }

        var res;

        const mutex = this.#getImageMutex( imagePath );

        await mutex.lock();

        try {
            dbh ||= this.dbh;

            // create image
            res = await dbh.selectRow( SQL.createImage, [

                //
                imagePath,
                hash,
                file.size,
                encrypt,
            ] );
            if ( !res.ok ) throw res;

            const imageId = res.data.id;

            // upload image
            if ( location.deduplicate ) {
                const imgeExists = await bucket.imageExists( imagePath );

                if ( !imgeExists ) {
                    res = await bucket.uploadImage( imagePath, file, { encrypt } );
                    if ( !res.ok ) throw res;
                }
            }
            else {
                res = await bucket.uploadImage( imagePath, file, { encrypt } );
                if ( !res.ok ) throw res;
            }

            expires = this.#caclulateExpires( expires, maxAge, inactiveMaxAge );

            // upsert file
            res = await dbh.selectRow( SQL.createFile, [

                //
                filePath,
                imageId,
                lastModified,
                contentType ?? file.type,
                cacheControl,
                contentDisposition,
                inactiveMaxAge?.toString(),
                expires,
            ] );
            if ( !res.ok ) throw res;

            res = result( 200, {
                "id": res.data.id,
                filePath,
            } );
        }
        catch ( e ) {
            res = e;
        }

        await mutex.unlock();

        return res;
    }

    async fileExists ( filePath, { cwd, checkImage, dbh } = {} ) {
        const file = await this.getFileMeta( filePath, { cwd, checkImage, dbh } );

        if ( file ) {
            return true;
        }
        else {
            return file;
        }
    }

    async getFileMeta ( filePath, { cwd, checkImage, dbh } = {} ) {
        const file = await this.#cache.get( filePath, { cwd, "updateExpires": false, dbh } );

        if ( !file ) return file;

        // check image exists
        if ( checkImage ) {
            const bucket = file.location.bucket;

            const imageExists = await bucket.imageExists( file.imagePath );

            if ( !imageExists ) return imageExists;
        }

        return file;
    }

    async getFile ( filePath, { cwd, dbh } = {} ) {
        const file = await this.#cache.get( filePath, { cwd, dbh } );

        if ( !file ) {
            return result( 404 );
        }
        else {
            const bucket = file.location.bucket;

            return bucket.getFile( file );
        }
    }

    async getBuffer ( filePath, { cwd, dbh } = {} ) {
        const file = await this.#cache.get( filePath, { cwd, dbh } );

        if ( !file ) {
            return result( 404 );
        }
        else {
            const bucket = file.location.bucket;

            return bucket.getBuffer( file );
        }
    }

    async downloadFile ( req, filePath, { cwd, contentType, cacheControl, contentDisposition, dbh } = {} ) {
        const file = await this.#cache.get( filePath, { cwd, dbh } );

        if ( !file ) {
            return req.end( 404 );
        }
        else {
            const headers = file.getHeaders(),
                location = file.location,
                bucket = location.bucket;

            if ( cacheControl === undefined ) cacheControl = location.cacheControl;

            if ( contentType ) headers[ "content-type" ] = contentType;
            if ( cacheControl ) headers[ "cache-control" ] = cacheControl;
            if ( contentDisposition ) headers[ "content-disposition" ] = contentDisposition;

            return bucket.downloadFile( req, file, headers );
        }
    }

    async glob ( patterns, { cwd, dbh } = {} ) {
        dbh ||= this.dbh;

        const where = sql.where( {
            "path": [ "glob", [ patterns, { cwd } ] ],
        } );

        where.and( `expires IS NULL OR expires > CURRENT_TIMESTAMP` );

        return dbh.select( sql`SELECT id, path FROM storage_file`.WHERE( where ) );
    }

    async deleteFile ( patterns, { cwd, dbh } = {} ) {
        var res;

        dbh ||= this.dbh;

        // id
        if ( !cwd && this.#cache.isFileId( patterns ) ) {
            res = await dbh.do( SQL.deleteFileById, [ patterns ] );
        }

        // patterns
        else {
            const where = sql.where( {
                "path": [ "glob", [ patterns, { cwd } ] ],
            } );

            res = await dbh.do( sql`DELETE FROM storage_file`.WHERE( where ) );
        }

        if ( res.meta.rows ) {
            if ( dbh.inTransaction ) {
                dbh.on( "commit", () => this.clear() );
            }
            else {
                this.clear();
            }
        }

        return res;
    }

    // private
    #getClearMutex () {
        const id = "storage/clear";

        return this.app.cluster?.mutexes.get( id ) || this.#mutexSet.get( id );
    }

    #getImageMutex ( imagePath ) {
        const id = "storage/file/" + imagePath;

        return this.app.cluster?.mutexes.get( id ) || this.#mutexSet.get( id );
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
        var path;

        if ( this.#config.location === "/" ) {
            path = req.path;
        }
        else {
            path = req.path.substring( this.#config.location.length );
        }

        return this.downloadFile( req, path );
    }

    async #privateLocation ( req ) {
        req.end( 403 );
    }

    #caclulateExpires ( expires, maxAge, inactiveMaxAge ) {
        if ( expires && !( expires instanceof Date ) ) expires = new Date( expires );

        if ( maxAge ) {
            const expires1 = Interval.new( maxAge ).toDate();

            if ( !expires || expires1 < expires ) expires = expires1;
        }

        if ( inactiveMaxAge ) {
            const expires1 = Interval.new( inactiveMaxAge ).toDate();

            if ( !expires || expires1 < expires ) expires = expires1;
        }

        return expires;
    }

    async #deleteImage ( imagePath ) {
        var res;

        // lock
        const mutex = this.#getImageMutex( imagePath );

        await mutex.lock();

        const bucket = this.#buckets.getBucket( imagePath );

        try {

            // get image links count
            res = await this.dbh.selectRow( SQL.getImageLinksCount, [ imagePath ] );

            if ( !res.ok ) throw res;

            // image deletet or locked
            if ( res.data?.links_count ) throw result( 200 );

            // deleteeee image
            res = await bucket.deleteImage( imagePath );
            if ( !res.ok ) throw res;

            res = await this.dbh.do( SQL.deleteImage, [ imagePath ] );
            if ( !res.ok ) throw res;

            res = result( 200 );
        }
        catch ( e ) {
            res = e;
        }

        // unlock
        await mutex.unlock();

        return res;
    }
}
