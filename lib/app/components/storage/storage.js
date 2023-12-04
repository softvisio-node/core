import crypto from "node:crypto";
import sql from "#lib/sql";
import Cron from "#lib/cron";
import Mutex from "#lib/threads/mutex";
import Cache from "./storage/cache.js";
import Duration from "#lib/duration";

const HASH_ALGORYTM = "SHA256",
    HASH_ENCODING = "base64url";

const DEFAULT_CLEAR_FILES_CRON = "0 * * * *";

const SQL = {
    "deleteExpiredFiles": sql`DELETE FROM storage_file WHERE expires <= CURRENT_TIMESTAMP`.prepare(),

    "selectDeletedImage": sql`SELECT path FROM storage_image WHERE links_count = 0 LIMIT 1`.prepare(),

    "createImage": sql`INSERT INTO storage_image ( path ) VALUES ( ? ) ON CONFLICT ( path ) DO NOTHING`.prepare(),

    "createFile": sql`
SELECT storage_create_file(
    _path => ?,
    _hash => ?,
    _size => ?,
    _last_modified => ?,
    _content_type => ?,
    _cache_control => ?,
    _content_disposition => ?,
    _inactive_max_age => ?,
    _expires => ?
) AS id;
`.prepare(),

    "deleteFileById": sql`DELETE FROM storage_file WHERE id = ?`.prepare(),

    "deleteImage": sql`DELETE FROM storage_image WHERE path = ?`.prepare(),
};

export default class Storage {
    #app;
    #config;
    #location;
    #locations = {};
    #sortedLocations;
    #dbh;
    #clearCron;
    #mutexSet = new Mutex.Set();
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
        const clearMutex = this.#getClearMutex();

        const locked = await clearMutex.tryLock();

        if ( !locked ) return;

        try {
            var res;

            res = await this.dbh.do( SQL.deleteExpiredFiles );
            if ( !res.ok ) throw res;

            while ( true ) {
                const image = await this.dbh.selectRow( SQL.selectDeletedImage );
                if ( !image.data ) break;

                // lock
                const mutex = this.#getFileMutex( image.data.path );
                await mutex.lock();

                try {

                    // deleteeee image
                    res = await this._deleteImage( image.data.psth );
                    if ( !res.ok ) throw res;

                    res = await this.dbh.do( SQL.deleteImage, [image.data.psth] );
                    if ( !res.ok ) throw res;
                }
                catch ( e ) {}

                // unlock
                await mutex.unlock();
            }
        }
        catch ( e ) {}

        await clearMutex.unlock();
    }

    async uploadFile ( path, file, { lastModified, contentType, cacheControl, contentDisposition, expires, maxAge, inactiveMaxAge, dbh } = {} ) {
        path = this.#cache.normalizePath( path );

        const location = this.#getLocation( path );

        if ( maxAge === undefined ) maxAge = location.maxAge;

        if ( inactiveMaxAge ) {
            inactiveMaxAge = Duration.new( inactiveMaxAge );
        }
        else if ( inactiveMaxAge === undefined ) {
            inactiveMaxAge = location.inactiveMaxAge;
        }

        var res;

        const mutex = this.#getFileMutex( path );

        await mutex.lock();

        try {
            dbh ||= this.#dbh;

            // create image
            res = await this.dbh.do( SQL.createImage, [path] );
            if ( !res.ok ) throw res;

            // upload image
            res = await this._uploadImage( path, file );
            if ( !res.ok ) throw res;

            const hash = await this.#getHash( file );

            expires = this.#caclulateExpires( expires, maxAge, inactiveMaxAge );

            // upsert file
            res = await dbh.selectRow( SQL.createFile, [

                //
                path,
                hash,
                file.size,
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

    async isFileExists ( id, { dbh } = {} ) {
        const file = await this.#cache.get( id, { "updateExpires": false, dbh } );

        return !!file;
    }

    async getFile ( id, { dbh } = {} ) {
        const file = await this.#cache.get( id, { dbh } );

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
            const headers = file.getHeaders(),
                location = this.#getLocation( file.path );

            if ( cacheControl === undefined ) cacheControl = location.cacheControl;

            if ( contentType ) headers["content-type"] = contentType;
            if ( cacheControl ) headers["cache-control"] = cacheControl;
            if ( contentDisposition ) headers["content-disposition"] = contentDisposition;

            return this._downloadFile( req, file.path, headers );
        }
    }

    async glob ( patterns, { dbh } = {} ) {
        dbh ||= this.#dbh;

        return dbh.select( sql`SELECT id, path FROM storage_file`.WHERE(
            {
                "path": ["glob", patterns],
            },
            `AND ( expires IS NULL OR expires > CURRENT_TIMESTAMP )`
        ) );
    }

    // XXX delete if not pattern
    async deleteFile ( id, { dbh } = {} ) {
        dbh ||= this.#dbh;

        if ( this.#cache.isId( id ) ) {
            return dbh.do( SQL.deleteFileById, [id] );
        }
        else {
            return dbh.do( sql`DELETE FROM storage_file`.WHERE( {
                "path": ["glob", id],
            } ) );
        }
    }

    // protected
    async _init () {
        return result( 200 );
    }

    // XXX shutdowf

    // private
    #getClearMutex () {
        const id = "storage/clear";

        return this.app.cluster?.mutexes.get( id ) || this.#mutexSet.get( id );
    }

    #getFileMutex ( path ) {
        const id = "storage/file/" + path;

        return this.app.cluster?.mutexes.get( id ) || this.#mutexSet.get( id );
    }

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
        var path;

        if ( this.#location === "/" ) {
            path = req.path;
        }
        else {
            path = req.path.substring( this.#location.length );
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
}
