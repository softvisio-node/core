import "#lib/shutdown";
import sql from "#lib/sql";
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import Cron from "#lib/cron";
import Mutex from "#lib/threads/mutex";
import mime from "#lib/mime";

const ALLOWED_CATEGORIES = new Set( ["image", "audio", "video", "document"] ),
    DEFAULT_CATEGORY = "document";

const HASH_ALGORYTM = "SHA3-512",
    HASH_ENCODING = "hex";

const DEFAULT_CLEAR_FILES_LIMIT = 100,
    DEFAULT_CLEAR_FILES_CRON = "0 * * * *";

const QUERIES = {
    "getFile": sql`
SELECT
    static_files_file.guid,
    static_files_file.size,
    static_files_link.id,
    static_files_link.type,
    static_files_link.category,
    static_files_link.name,
    static_files_link.headers
FROM
    static_files_file,
    static_files_link
WHERE
    static_files_file.id = static_files_link.static_files_file_id
    AND static_files_link.guid = ?
`.prepare(),

    "insertFile": sql`
WITH file AS (
    INSERT INTO static_files_file ( hash, size ) VALUES ( ?, ? )
    ON CONFLICT ( hash ) DO UPDATE SET size = EXCLUDED.size
    RETURNING id, guid, links_count
)
INSERT INTO static_files_link ( static_files_file_id, type, category, name, headers ) VALUES ( ( SELECT id FROM file ), ?, ?, ?, ? )
RETURNING id, guid, ( SELECT guid FROM file ) AS file_guid, ( SELECT links_count FROM file ) AS file_links_count
`.prepare(),

    "selectDeletedFiles": sql`SELECT id, guid FROM static_files_file WHERE hash IS NULL LIMIT ?`.prepare(),

    "delete": sql`DELETE FROM static_files_link WHERE id = ?`.prepare(),
};

export default class StaticFiles {
    #dbh;
    #location;
    #externalStorage;
    #clearFilesLimit;
    #clearCron;
    #clearMutex = new Mutex();
    #shutdownSignal;
    #mutexSet = new Mutex.Set( { "destroyOnFinish": true } );

    constructor ( dbh, location, { clearFilesLimit } = {} ) {
        this.#dbh = dbh;
        this.#location = path.resolve( location );
        this.#clearFilesLimit = clearFilesLimit || DEFAULT_CLEAR_FILES_LIMIT;

        if ( !fs.existsSync( this.#location ) ) fs.mkdirSync( this.#location, { "recursive": true } );

        this.#shutdownSignal = global.shutdown.signal( "file cache" ).on( "shutdown", this.#shutdown.bind( this ) );
    }

    // static
    static getFileCategory ( type ) {
        const mimeType = mime.get( type );

        if ( !mimeType ) return;

        return ALLOWED_CATEGORIES.has( mimeType.category ) ? mimeType.category : DEFAULT_CATEGORY;
    }

    // properties
    get dbh () {
        return this.#dbh;
    }

    get location () {
        return this.#location;
    }

    // public
    async init () {
        const res = await this.#dbh.schema.migrate( new URL( "static-files/db", import.meta.url ) );

        return res;
    }

    async add ( file, { name, headers, dbh } = {} ) {
        const hash = await this.#getHash( file.path );

        const type = file.type;

        const category = this.constructor.getFileCategory( type );

        if ( !category ) return result( [400, `Mime type is not valid`] );

        const size = file.size || 0;

        dbh ||= this.dbh;
        name ||= file.name;

        const res = await dbh.begin( async dbh => {
            const link = await dbh.selectRow( QUERIES.insertFile, [hash, size, type, category, name, headers] );

            if ( !link.ok ) throw link;

            const location = path.join( this.#location, link.data.file_guid );

            // new file
            if ( !+link.data.file_links_count ) {
                await fs.promises.copyFile( file.path, location );

                if ( this.#externalStorage ) {
                    const addExternal = await this.#addExternal( file, link.data.file_guid );

                    if ( !addExternal.ok ) throw addExternal;
                }
            }

            return result( 200, {
                "id": link.data.id,
                "guid": link.data.guid,
                size,
                category,
                "file": {
                    "path": location,
                    name,
                    type,
                },
            } );
        } );

        return res;
    }

    async get ( guid ) {
        const res = await this.dbh.selectRow( QUERIES.getFile, [guid] );

        if ( !res.ok ) return res;

        if ( !res.data ) return result( 404 );

        const location = path.join( this.#location, res.data.guid );

        if ( this.#externalStorage && !fs.existsSync( location ) ) {
            const getExternal = await this.getExternal( guid, location );

            if ( !getExternal.ok ) return getExternal;
        }

        return result( 200, {
            "id": res.data.id,
            "size": res.data.size,
            "category": res.data.category,
            "headers": res.data.headers,
            "file": {
                "path": location,
                "name": res.data.name,
                "type": res.data.type,
            },
        } );
    }

    async delete ( id ) {
        return this.dbh.do( QUERIES.delete, [id] );
    }

    async clear () {
        if ( !this.#clearMutex.tryDown() ) return this.#clearMutex.signal.wait();

        while ( true ) {
            const files = await this.dbh.select( QUERIES.selectDeletedFiles, [this.#clearFilesLimit] );

            if ( !files.data ) break;

            const deletedFiles = [];

            for ( const file of files.data ) {
                fs.promises.rm( path.join( this.#location, file.guid ), { "force": true } );

                if ( this.#externalStorage ) {
                    const deleteExternal = await this.#deleteExternal( file.guid );

                    if ( !deleteExternal.ok ) continue;
                }

                deletedFiles.push( file.id );
            }

            if ( deletedFiles.length ) {
                const deleted = await this.dbh.do( sql`DELETE FROM static_files_file WHERE id`.IN( deletedFiles ) );

                if ( !deleted.ok ) continue;

                if ( deletedFiles.length !== files.data.length ) continue;
            }

            if ( files.data.length < this.#clearFilesLimit ) break;
        }

        this.#clearMutex.signal.broadcast();
        this.#clearMutex.up();
    }

    startAutoClear ( clearFilesCron ) {
        this.#clearCron ??= new Cron( clearFilesCron || DEFAULT_CLEAR_FILES_CRON ).on( "tick", this.clear.bind( this ) ).unref().start();

        return this;
    }

    // private
    // XXX
    async #shutdown ( graceful ) {
        this.#shutdownSignal.done();
    }

    async #getHash ( path ) {
        return new Promise( resolve => {
            const hash = crypto
                .createHash( HASH_ALGORYTM )
                .setEncoding( HASH_ENCODING )
                .on( "finish", () => resolve( hash.read() ) );

            fs.createReadStream( path ).pipe( hash );
        } );
    }

    async #addExternal ( file, guid ) {
        return this.#externalStorage.add( file, guid );
    }

    async #getExternal ( guid, location ) {
        const mutex = this.#mutexSet.get( `download/${guid}` );

        if ( !mutex.tryDown() ) return await mutex.signal.wait();

        const res = this.#externalStorage.get( guid, location );

        mutex.signal.broadcast( res );
        mutex.up();

        return res;
    }

    async #deleteExternal ( guid ) {
        return this.#externalStorage.delete( guid );
    }
}
