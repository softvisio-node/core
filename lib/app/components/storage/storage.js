import crypto from "node:crypto";
import sql from "#lib/sql";
import Cron from "#lib/cron";

const HASH_ALGORYTM = "SHA3-512",
    HASH_ENCODING = "hex";

const DEFAULT_CLEAR_FILES_LIMIT = 100,
    DEFAULT_CLEAR_FILES_CRON = "0 * * * *";

const QUERIES = {
    "lock": sql`SELECT pg_try_advisory_lock( get_lock_id( 'storage/clear' ) ) AS locked`.prepare(),

    "unlock": sql`SELECT pg_advisory_unlock( get_lock_id( 'storage/clear' ) )`.prepare(),

    "selectDeletedFiles": sql`SELECT id FROM storage_file WHERE hash IS NULL LIMIT ?`.prepare(),
};

export default class Storage {
    #app;
    #config;
    #dbh;
    #clearCron;
    #shutdownSignal;
    #isClearing;

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;
        this.#dbh = app.dbh;

        this.#shutdownSignal = global.shutdown.signal( "file cache" ).on( "shutdown", this.#shutdown.bind( this ) );
    }

    // properties
    get app () {
        return this.#app;
    }

    get config () {
        return this.#config;
    }

    // public
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
        this.#clearCron = new Cron( DEFAULT_CLEAR_FILES_CRON ).on( "tick", this.clear.bind( this ) ).unref().start();

        this.app.publicHttpServer.get( "/storage/*", this.#getFile.bind( this ) );

        return result( 200 );
    }

    async clear () {
        if ( this.#isClearing ) return;

        this.#isClearing = true;

        await this.#dbh.lock( async dbh => {
            var res;

            // lock
            res = await dbh.selectRow( QUERIES.lock );
            if ( !res.ok ) throw res;

            // not locked
            if ( !res.data.locked ) return;

            while ( true ) {
                const files = await dbh.select( QUERIES.selectDeletedFiles, [DEFAULT_CLEAR_FILES_LIMIT] );

                if ( !files.data ) break;

                const deletedFiles = [];

                for ( const file of files.data ) {
                    const res = await this._deleteFile( file.id );

                    // error deleting file
                    if ( !res.ok ) break;

                    deletedFiles.push( file.id );
                }

                if ( deletedFiles.length ) {
                    await dbh.do( sql`DELETE FROM storage_file WHERE id`.IN( deletedFiles ) );
                }
            }

            // unlock
            res = await dbh.selectRow( QUERIES.unlock );
            if ( !res.ok ) throw res;
        } );

        this.#isClearing = false;
    }

    // XXX updat elastModified on duplicate
    async uploadFile ( path, file, headers ) {}

    // XXX
    async deleteFile ( path ) {}

    async copyFile ( from, to, metadata ) {}

    async getFileMetadata ( path ) {}

    async updateFileMetadata ( path, metadata ) {}

    // protected
    async _init () {
        return result( 200 );
    }

    // private
    #getHash ( file ) {
        return new Promise( resolve => {
            const hash = crypto
                .createHash( HASH_ALGORYTM )
                .setEncoding( HASH_ENCODING )
                .on( "finish", () => resolve( hash.read() ) );

            file.stream()().pipe( hash );
        } );
    }

    // XXX
    async #shutdown ( graceful ) {
        this.#shutdownSignal.done();
    }

    // XXX
    async #getFile ( req ) {
        req.end( 404 );
    }
}
