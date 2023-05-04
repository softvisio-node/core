import Events from "#lib/events";
import DoubleLinkedList from "#lib/data/doubly-linked-list";
import CacheLruEntry from "#lib/cache/lru/entry";

export default class CacheLru extends Events {
    #maxSize;
    #maxAge;

    #list = new DoubleLinkedList();
    #map = new Map();

    constructor ( { maxSize, maxAge } = {} ) {
        super();

        this.maxSize = maxSize;
        this.maxAge = maxAge;
    }

    // properties
    get maxSize () {
        return this.#maxSize;
    }

    set maxSize ( value ) {
        if ( value == null ) value = null;
        else if ( value === Infinity ) value = 0;
        else if ( typeof value !== "number" || value < 0 ) throw Error( `Cache maxSize should be positive or zero integer` );

        // not updated
        if ( value === this.#maxSize ) return;

        this.#maxSize = value;

        this.emit( "option", "maxSize" );

        if ( this.#maxSize ) {
            while ( this.#map.size > this.#maxSize ) {
                this.#delete( this.#list.first );
            }
        }
    }

    get maxAge () {
        return this.#maxAge;
    }

    set maxAge ( value ) {
        if ( value == null ) value = null;
        else if ( value === Infinity ) value = 0;
        else if ( typeof value !== "number" ) throw Error( `Cache maxAge should be integer` );

        // not updated
        if ( value === this.#maxAge ) return;

        this.#maxAge = value;

        this.emit( "option", "maxAge" );
    }

    get size () {
        return this.#map.size;
    }

    // public
    has ( key ) {
        const entry = this.#map.get( key );

        if ( !entry ) return false;

        if ( entry.isExpired ) {
            this.#delete( entry, true );

            return false;
        }
        else {
            return true;
        }
    }

    get ( key, { silent } = {} ) {
        const entry = this.#map.get( key );

        if ( !entry ) return;

        // entry is expired
        if ( entry.isExpired ) {

            // delete entry
            this.#delete( entry );
        }

        // entry is not expired
        else {

            // move key to the top of the cache
            if ( !silent ) this.#list.push( entry );

            // return value
            return entry.value;
        }
    }

    set ( key, value, maxAge ) {
        if ( maxAge == null ) maxAge = this.#maxAge;
        else if ( typeof maxAge !== "number" ) throw Error( `Max age should be a number` );

        const add = !maxAge || maxAge > 0;

        var entry = this.#map.get( key );

        // key is exists
        if ( entry ) {

            // delete old entry, emit "delete" event if not add
            this.#delete( entry, add );
        }

        // key is not exists, cache size limit reached
        else if ( add && this.#maxSize && this.#map.size >= this.#maxSize ) {

            // remove first cached entry
            this.#delete( this.#list.first );
        }

        // do not add entry if it was expired
        if ( !add ) return;

        entry = new CacheLruEntry( key, value, maxAge );

        this.#map.set( key, entry );
        this.#list.push( entry );
    }

    delete ( key, { silent } = {} ) {
        const entry = this.#map.get( key );

        if ( !entry ) return;

        this.#delete( entry, silent );

        return entry.value;
    }

    clear ( { silent } = {} ) {
        const list = this.#list;

        this.#list = new DoubleLinkedList();
        this.#map = new Map();

        if ( !silent && this.listenerCount( "delete" ) ) {
            list.forEachEntry( entry => {
                this.emit( "delete", entry.key, entry.value );
            } );
        }
    }

    prune ( { silent } = {} ) {
        for ( const entry of this.#list ) {
            if ( entry.isExpired ) this.#delete( entry, silent );
        }
    }

    getEntry ( key ) {
        const entry = this.#map.get( key );

        if ( entry && entry.isExpired ) this.#delete( entry, true );

        return entry;
    }

    // private
    #delete ( entry, silent ) {
        this.#map.delete( entry.key );

        entry.delete();

        if ( !silent ) this.emit( "delete", entry.key, entry.value );
    }
}
