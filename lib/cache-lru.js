import Events from "#lib/events";
import DoubleLinkedList from "#lib/doubly-linked-list";

class CacheLruEntry extends DoubleLinkedList.Node {
    #key;
    #maxAge;
    #created;

    constructor ( key, value, maxAge ) {
        super( value );

        this.#key = key;

        if ( maxAge ) {
            this.#maxAge = maxAge;
            this.#created = Date.now();
        }
    }

    // properties
    get key () {
        return this.#key;
    }

    get isStale () {
        if ( !this.#maxAge ) return false;

        const age = Date.now() - this.#created;

        return age > this.#maxAge;
    }
}

export default class CacheLru extends Events {
    #maxSize;
    #maxAge;
    #stale;

    #list = new DoubleLinkedList();
    #map = new Map();

    constructor ( options = {} ) {
        super();

        this.maxSize = options.maxSize;
        this.maxAge = options.maxAge;
        this.stale = options.stale;
    }

    // static
    get Entry () {
        return CacheLruEntry;
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

    get stale () {
        return this.#stale;
    }

    set stale ( value ) {

        // not updated
        if ( !!value === this.#stale ) return;

        this.#stale = !!value;

        this.emit( "option", "stale" );
    }

    get size () {
        return this.#map.size;
    }

    // public
    has ( key ) {
        const entry = this.#map.get( key );

        if ( this.#stale ) {
            return !!entry;
        }
        else {
            return !!( entry && !entry.isStale );
        }
    }

    get ( key ) {
        const entry = this.#map.get( key );

        if ( !entry ) return;

        // entry is stale
        if ( entry.isStale ) {

            // delete entry
            this.#delete( entry );

            // return stale value
            if ( this.#stale ) return entry.value;

            // return nothing
            else return;
        }

        // entry is not stale
        else {

            // move key to the top of the cache
            this.#list.push( entry );

            // return value
            return entry.value;
        }
    }

    set ( key, value, maxAge ) {
        if ( maxAge == null ) maxAge = this.#maxAge;
        else if ( typeof maxAge !== "number" ) throw Error( `Max age should be a number` );

        const add = !maxAge || maxAge > 0 || this.#stale;

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

        // do not add entry if it was expired and `stale` option is false
        if ( !add ) return;

        entry = new CacheLruEntry( key, value, maxAge );

        this.#map.set( key, entry );
        this.#list.push( entry );
    }

    delete ( key, options = {} ) {
        const entry = this.#map.get( key );

        if ( !entry ) return;

        this.#delete( entry, options.silent );

        return entry.value;
    }

    reset ( options = {} ) {
        const list = this.#list;

        this.#list = new DoubleLinkedList();
        this.#map = new Map();

        if ( !options.silent && this.listenerCount( "delete" ) ) {
            list.forEachNode( entry => {
                this.emit( "delete", entry.key, entry.value );
            } );
        }
    }

    prune ( options = {} ) {
        this.#list.forEachNode( entry => {
            if ( entry.isStale ) this.#delete( entry, options.stale );
        } );
    }

    // private
    #delete ( entry, silent ) {
        this.#map.delete( entry.key );
        this.#list.delete( entry );

        if ( !silent ) this.emit( "delete", entry.key, entry.value );
    }
}
