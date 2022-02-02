import Events from "#lib/events";
import DoubleLinkedList from "#lib/doubly-linked-list";

class CacheLruEntry extends DoubleLinkedList.Node {
    #key;
    #expires;

    constructor ( key, value, maxAge ) {
        super( value );

        this.#key = key;

        this.#expires = maxAge ? Date.now() + maxAge : false;
    }

    // properties
    get key () {
        return this.#key;
    }

    get isExpired () {
        return this.#expires && this.#expires < Date.now();
    }
}

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

    get size () {
        return this.#map.size;
    }

    // public
    has ( key ) {
        const entry = this.#map.get( key );

        return !!( entry && !entry.isExpired );
    }

    get ( key ) {
        const entry = this.#map.get( key );

        if ( !entry ) return;

        // entry is expired
        if ( entry.isExpired ) {

            // delete entry
            this.#delete( entry );

            return;
        }

        // entry is not expired
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

        if ( silent && this.listenerCount( "delete" ) ) {
            list.forEachNode( entry => {
                this.emit( "delete", entry.key, entry.value );
            } );
        }
    }

    prune ( { silent } = {} ) {
        this.#list.forEachNode( entry => {
            if ( entry.isExpired ) this.#delete( entry, silent );
        } );
    }

    // private
    #delete ( entry, silent ) {
        this.#map.delete( entry.key );
        this.#list.delete( entry );

        if ( !silent ) this.emit( "delete", entry.key, entry.value );
    }
}
