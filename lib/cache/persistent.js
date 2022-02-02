import CacheLru from "#lib/cache/lru";
import sql from "#lib/sql";
import msgpack from "#lib/msgpack";

const VACUUM_INTERVAL = 1000 * 60 * 60 * 4; // 4 hours

const query = {
    "schema": sql`
CREATE TABLE IF NOT EXISTS cache (
    id text PRIMARY KEY NOT NULL,
    value bytea NOT NULL,
    expires int53
);
`,
    "get": sql`SELECT * FROM cache WHERE id = ?`.decode( { "expires": "int53" } ).prepare(),
    "set": sql`INSERT INTO cache ( id, value, expires ) VALUES ( ?, ?, ? )  ON CONFLICT ( id ) DO UPDATE SET value = EXCLUDED.value, expires = EXCLUDED.expires`.prepare(),
    "delete": sql`DELETE FROM cache WHERE id = ?`.prepare(),
    "clear": sql`DELETE FROM cache`.prepare(),
    "prune": sql`DELETE FROM cache WHERE expired < CURRENT_TIMESTAMP`.prepare(),
};

export default class CachePersistent {
    #dbh;
    #cache;
    #maxAge;
    #vacuumInterval;

    constructor ( dbh, { maxSize, maxAge } = {} ) {
        this.#dbh = dbh;
        this.#cache = new CacheLru( { maxSize } );
        this.#maxAge = maxAge;

        this.#vacuumInterval = setInterval( this.#vacuum.bind( this ), VACUUM_INTERVAL );
    }

    // static
    static async new ( dbh, options ) {
        dbh = await sql.new( dbh );

        await dbh.exec( query.schema );

        return new this( dbh, options );
    }

    // public
    has ( key ) {
        key = String( key );

        if ( this.#cache.has( key ) ) return true;

        const entry = this.#dbh.selectRow( query.get, [key] );

        if ( !entry.data ) return false;

        // expired
        if ( entry.data.expires && entry.data.expires <= Date.now() ) return false;

        // decode value
        const value = msgpack.decode( entry.data.value );

        this.#cache.set( key, value, entry.data.expires && entry.data.expires - Date.now() );

        return true;
    }

    get ( key ) {
        key = String( key );

        if ( this.#cache.has( key ) ) return this.#cache.get( key );

        const entry = this.#dbh.selectRow( query.get, [key] );

        if ( !entry.data ) return;

        // expired
        if ( entry.data.expires && entry.data.expires <= Date.now() ) return;

        // decode value
        const value = msgpack.decode( entry.data.value );

        this.#cache.set( key, value, entry.data.expires && entry.data.expires - Date.now() );

        return value;
    }

    set ( key, value, maxAge ) {
        key = String( key );

        if ( value === undefined ) return;

        if ( maxAge == null ) maxAge = this.#maxAge;
        else if ( typeof maxAge !== "number" ) throw Error( `Max age should be a number` );

        if ( !maxAge || maxAge > 0 ) {
            const expires = Date.now() + maxAge;

            this.#cache.set( key, value, maxAge );
            this.#dbh.do( query.set, [key, msgpack.encode( value ), expires] );
        }
        else {
            this.delete( key );
        }
    }

    delete ( key ) {
        key = String( key );

        this.#cache.delete( key );
        this.#dbh.do( query.delete, [key] );
    }

    clear () {
        this.#cache.clear();
        this.#dbh.do( query.clear );
    }

    prune () {
        this.#cache.prune();
        this.#dbh.do( query.prune );
    }

    // private
    #vacuum () {
        this.#dbh.do( query.prune );
        this.#dbh.do( `VACUUM` );
    }
}
