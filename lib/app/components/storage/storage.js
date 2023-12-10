import crypto from "node:crypto";
import sql from "#lib/sql";
import Mutex from "#lib/threads/mutex";
import Cache from "./storage/cache.js";
import Duration from "#lib/duration";
import LocalBucket from "./storage/buckets/local.js";
import GoogleBucket from "./storage/buckets/google.js";
import path from "node:path";
import GlobPatterns from "#lib/glob/patterns";
import ThreadsPool from "#lib/threads/pool";
import Counter from "#lib/threads/counter";

const DELETE_IMAGES_LIMIT = 100,
    CLEAR_MAX_THREADS = 5,
    HASH_ALGORYTM = "SHA256",
    HASH_ENCODING = "hex";

const SQL = {
    "deleteExpiredFiles": sql`DELETE FROM storage_file WHERE expires <= CURRENT_TIMESTAMP`.prepare(),

    "selectDeletedImage": sql`SELECT path FROM storage_image WHERE links_count = 0 LIMIT ?`.prepare(),

    "createImage": sql`
SELECT storage_create_image(
    _path => ?,
    _hash => ?,
    _size => ?
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

    "getImageLinksCount": sql`SELECT links_count FROM storage_image WHERE path = ?`.prepate(),

    "deleteImage": sql`DELETE FROM storage_image WHERE path = ?`.prepare(),
};

export default class Storage {
    #app;
    #config;
    #buckets = {};
    #sortedBuckets;
    #locations = {};
    #sortedLocations;
    #dbh;
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
        this.#dbh = app.dbh;

        this.#cache = new Cache( app.dbh, config.maxCacheSize );
        this.#clearInterval = new Duration( this.#config.clearInterval );
    }

    // properties
    get app () {
        return this.#app;
    }

    get config () {
        return this.#config;
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

            const componentLocations = component.storageLocationsConfig;

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

        // init db
        res = await this.#dbh.schema.migrate( new URL( "db", import.meta.url ) );
        if ( !res.ok ) return res;

        const publicHttpServer = this.config.listenPublicHttpServer ? this.app.publicHttpServer : null,
            privateHttpServer = this.config.listenPrivateHttpServer ? this.app.privateHttpServer : null;

        for ( var [location, config] of Object.entries( this.config.locations ) ) {
            const httpLocation = this.#cache.normalizePath( this.#config.location + "/" + location );

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

        // init buckets
        for ( const [location, config] of Object.entries( this.config.buckets ) ) {
            let bucket;

            if ( config.type === "local" ) {
                bucket = new LocalBucket( this, location, config );
            }
            else if ( config.type === "google" ) {
                bucket = new GoogleBucket( this, location, config );
            }

            res = await bucket.init();
            if ( !res.ok ) return res;

            this.#buckets[bucket.location] = bucket;
        }

        this.#sortedBuckets = Object.keys( this.#buckets )
            .filter( location => location !== "/" )
            .sort( ( a, b ) => b.length - a.length );

        return result( 200 );
    }

    async start () {
        this.#clearTimeout = setTimeout( this.clear.bind( this ), this.#clearInterval.toMilliseconds() );

        return result( 200 );
    }

    getFileUrl ( path ) {
        return this.#cache.normalizePath( this.location + "/" + path );
    }

    async clear () {
        clearTimeout( this.#clearTimeout );

        const mutex = this.#getClearMutex();

        // locked
        if ( await mutex.tryLock() ) {
            while ( true ) {

                // delete expired files
                await this.#dbh.do( SQL.deleteExpiredFiles );

                // get images to delete
                const images = await this.#dbh.select( SQL.selectDeletedImage, [DELETE_IMAGES_LIMIT] );

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

    async uploadFile ( path, file, { lastModified, contentType, cacheControl, contentDisposition, expires, maxAge, inactiveMaxAge, dbh } = {} ) {

        // check path is valid
        if ( /[|<>"?\\:]/.test( path ) ) return result( [400, `Path is not valid`] );

        path = this.#cache.normalizePath( path );

        const bucket = this.#getBucket( path ),
            hash = await this.#getHash( file ),
            imagePath = bucket.createImagePath( path, hash ),
            location = this.#getLocation( path );

        if ( maxAge === undefined ) maxAge = location.maxAge;

        if ( inactiveMaxAge ) {
            inactiveMaxAge = Duration.new( inactiveMaxAge );
        }
        else if ( inactiveMaxAge === undefined ) {
            inactiveMaxAge = location.inactiveMaxAge;
        }

        var res;

        const mutex = this.#getImageMutex( imagePath );

        await mutex.lock();

        try {
            dbh ||= this.#dbh;

            // create image
            res = await dbh.selectRow( SQL.createImage, [

                //
                imagePath,
                hash,
                file.size,
            ] );
            if ( !res.ok ) throw res;

            const imageId = res.data.id;

            // upload image
            if ( bucket.deduplicate ) {
                const imgeExists = await bucket.imageExists( imagePath );

                if ( !imgeExists ) {
                    res = await bucket.uploadImage( imagePath, file );
                    if ( !res.ok ) throw res;
                }
            }
            else {
                res = await bucket.uploadImage( imagePath, file );
                if ( !res.ok ) throw res;
            }

            expires = this.#caclulateExpires( expires, maxAge, inactiveMaxAge );

            // upsert file
            res = await dbh.selectRow( SQL.createFile, [

                //
                path,
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
                path,
            } );
        }
        catch ( e ) {
            res = e;
        }

        await mutex.unlock();

        return res;
    }

    async fileExists ( id, { checkImage, dbh } = {} ) {
        const file = await this.#cache.get( id, { "updateExpires": false, dbh } );

        if ( !file ) return false;

        if ( checkImage ) {
            const bucket = this.#getBucket( file.path );

            return bucket.imageExists( file.path );
        }
        else {
            return true;
        }
    }

    async getFile ( id, { dbh } = {} ) {
        const file = await this.#cache.get( id, { dbh } );

        if ( !file ) {
            return result( 404 );
        }
        else {
            const bucket = this.#getBucket( file.path );

            return bucket.getFile( file );
        }
    }

    async downloadFile ( req, id, { contentType, cacheControl, contentDisposition, dbh } = {} ) {
        const file = await this.#cache.get( id, { dbh } );

        if ( !file ) {
            return req.end( 404 );
        }
        else {
            const headers = file.getHeaders(),
                location = this.#getLocation( file.path );

            if ( cacheControl === undefined ) cacheControl = location.cacheControl;

            if ( contentType ) headers["content-type"] = contentType;
            if ( cacheControl ) headers["cache-control"] = cacheControl;
            if ( contentDisposition ) headers["content-disposition"] = contentDisposition;

            const bucket = this.#getBucket( file.path );

            return bucket.downloadFile( req, file.path, headers );
        }
    }

    async glob ( patterns, { cwd, dbh } = {} ) {
        dbh ||= this.#dbh;

        const where = sql.where();

        // path
        if ( !Array.isArray( patterns ) && !GlobPatterns.isGlobPattern( patterns ) ) {
            where.and( {
                "path": ["=", path.posix.join( "/", cwd || "", patterns )],
            } );
        }

        // glob
        else {
            if ( cwd ) {
                cwd = path.posix.join( "/", cwd );
                if ( cwd !== "/" ) cwd += "/";

                where.and( {
                    "path": ["starts with", cwd],
                } );
            }

            where.and( {
                "path": ["glob", patterns],
            } );
        }

        where.and( `expires IS NULL OR expires > CURRENT_TIMESTAMP` );

        return dbh.select( sql`SELECT id, path FROM storage_file`.WHERE( where ) );
    }

    // XXX
    async deleteFile ( patterns, { cwd, dbh } = {} ) {
        dbh ||= this.#dbh;

        // id
        if ( this.#cache.isId( patterns ) ) {
            return dbh.do( SQL.deleteFileById, [patterns] );
        }
        else {
            const where = sql.where();

            // path
            if ( !Array.isArray( patterns ) && !GlobPatterns.isGlobPattern( patterns ) ) {
                where.and( {
                    "path": ["=", path.posix.join( "/", cwd || "", patterns )],
                } );
            }

            // glob
            else {
                if ( cwd ) {
                    cwd = path.posix.join( "/", cwd );
                    if ( cwd !== "/" ) cwd += "/";

                    where.and( {
                        "path": ["starts with", cwd],
                    } );
                }

                where.and( {
                    "path": ["glob", patterns],
                } );
            }

            return dbh.do( sql`DELETE FROM storage_file`.WHERE( where ) );
        }
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

    #getLocation ( path ) {
        for ( const location of this.#sortedLocations ) {
            if ( path.startsWith( location + "/" ) ) return this.#locations[location];
        }

        return this.#locations["/"];
    }

    #getBucket ( path ) {
        for ( const location of this.#sortedBuckets ) {
            if ( path.startsWith( location + "/" ) ) return this.#buckets[location];
        }

        return this.#buckets["/"];
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
            const expires1 = Duration.new( maxAge ).toDate();

            if ( !expires || expires1 < expires ) expires = expires1;
        }

        if ( inactiveMaxAge ) {
            const expires1 = Duration.new( inactiveMaxAge ).toDate();

            if ( !expires || expires1 < expires ) expires = expires1;
        }

        return expires;
    }

    async #deleteImage ( parrg ) {
        var res;

        // lock
        const mutex = this.#getImageMutex( path );
        await mutex.lock();

        const bucket = this.#getBucket( path );

        try {

            // get image links count
            res = await this.dbh.selectRow( SQL.getImageLinksCount, [path] );
            if ( !res.ok ) throw res;

            // image deletet or locked
            if ( res.data?.links_ccount ) throw result( 200 );

            // deleteeee image
            res = await bucket.deleteImage( path );
            if ( !res.ok ) throw res;

            res = await this.#dbh.do( SQL.deleteImage, [path] );
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
