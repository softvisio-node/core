import "#lib/shutdown";
import sql from "#lib/sql";
import fs from "node:fs";
import crypto from "node:crypto";
import Cron from "#lib/cron";
import LocalStore from "./static-file/local.js";

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
INSERT INTO static_files_link ( static_files_file_id, type, name, headers ) VALUES ( ( SELECT id FROM file ), ?, ?, ? )
RETURNING id, guid, ( SELECT guid FROM file ) AS file_guid, ( SELECT links_count FROM file ) AS file_links_count
`.prepare(),

    "selectDeletedFiles": sql`SELECT id, guid FROM static_files_file WHERE hash IS NULL LIMIT ?`.prepare(),

    "delete": sql`DELETE FROM static_files_link WHERE id = ?`.prepare(),

    "lock": sql`SELECT pg_try_advisory_lock( get_lock_id( 'static-files/clear' ) ) AS locked`.prepare(),

    "unlock": sql`SELECT pg_try_advisory_unlock( get_lock_id( 'static-files/clear' ) )`.prepare(),
};

export default class StaticFiles {
    #dbh;
    #store;
    #clearFilesLimit;
    #clearCron;
    #shutdownSignal;

    constructor ( dbh, location, { clearFilesLimit } = {} ) {
        this.#dbh = dbh;
        this.#store = new LocalStore( this, location );
        this.#clearFilesLimit = clearFilesLimit || DEFAULT_CLEAR_FILES_LIMIT;

        this.#shutdownSignal = global.shutdown.signal( "file cache" ).on( "shutdown", this.#shutdown.bind( this ) );
    }

    // properties
    get dbh () {
        return this.#dbh;
    }

    // public
    async init () {
        const res = await this.#dbh.schema.migrate( new URL( "static-files/db", import.meta.url ) );

        return res;
    }

    async add ( file, { name, headers, dbh } = {} ) {
        const hash = await this.#getHash( file.path ),
            type = file.type,
            size = file.size || 0;

        dbh ||= this.dbh;
        name ||= file.name;

        const res = await dbh.begin( async dbh => {
            const link = await dbh.selectRow( QUERIES.insertFile, [hash, size, type, name, headers] );

            if ( !link.ok ) throw link;

            // new file
            if ( !+link.data.file_links_count ) {
                const res = await this.#store.add( file, link.data.file_guid );
                if ( !res.ok ) throw res;
            }

            return result( 200, {
                "id": link.data.id,
                "guid": link.data.guid,
                name,
                type,
                size,
            } );
        } );

        return res;
    }

    async get ( guid ) {
        const res = await this.dbh.selectRow( QUERIES.getFile, [guid] );

        if ( !res.ok ) return res;

        if ( !res.data ) return result( 404 );

        const file = await this.#store.get( res.data.guid );

        file.name = res.data.name;
        file.name = res.data.type;

        return result( 200, {
            "id": res.data.id,
            "size": res.data.size,
            "headers": res.data.headers,
            file,
        } );
    }

    async delete ( id ) {
        return this.dbh.do( QUERIES.delete, [id] );
    }

    async clear () {
        const res = await this.dbh.lock( async dbh => {
            var res = await dbh.selectRow( QUERIES.lock );
            if ( !res.ok ) throw res;

            if ( !res.data.locked ) return;

            while ( true ) {
                const files = await dbh.select( QUERIES.selectDeletedFiles, [this.#clearFilesLimit] );

                if ( !files.data ) break;

                const deletedFiles = [];

                for ( const file of files.data ) {
                    const res = await this.#store.clear( file.guid );

                    if ( !res.ok ) continue;

                    deletedFiles.push( file.id );
                }

                if ( deletedFiles.length ) {
                    const deleted = await dbh.do( sql`DELETE FROM static_files_file WHERE id`.IN( deletedFiles ) );

                    if ( !deleted.ok ) continue;

                    if ( deletedFiles.length !== files.data.length ) continue;
                }

                if ( files.data.length < this.#clearFilesLimit ) break;
            }

            res = await dbh.selectRow( QUERIES.unlock );
            if ( !res.ok ) throw res;
        } );

        return res;
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
}
