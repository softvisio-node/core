import Events from "#lib/events";

class CacheLruEntry {
    #key;
    #value;
    #maxAge;
    #created;

    constructor ( key, value, maxAge ) {
        this.#key = key;
        this.#value = value;

        if ( maxAge ) {
            this.#maxAge = maxAge;
            this.#created = Date.now();
        }
    }

    // properties
    get key () {
        return this.#key;
    }

    get value () {
        return this.#value;
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
    #stale; // allows to set / get stale values
    #map = new Map();
    #last;

    constructor ( { maxSize, maxAge, stale } = {} ) {
        super();

        this.maxSize = maxSize;
        this.maxAge = maxAge;
        this.stale = stale;
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
                this.#delete( this.#map.keys().next().value );
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
            if ( this.#last !== key ) {
                this.#map.delete( key );
                this.#map.set( key, entry );
                this.#last = key;
            }

            // return value
            return entry.value;
        }
    }

    set ( key, value, maxAge ) {
        if ( maxAge == null ) maxAge = this.#maxAge;
        else if ( typeof maxAge !== "number" ) throw Error( `Max age should be a number` );

        const add = maxAge >= 0 || this.#stale;

        var entry = this.#map.get( key );

        // key is exists
        if ( entry ) {

            // delete old entry, emit "delete" event if not add
            this.#delete( entry, add );
        }

        // key is not exists, cache size limit reached
        else if ( add && this.#maxSize && this.#map.size >= this.#maxSize ) {

            // remove first cached entry
            this.#delete( this.#map.values().next().value );
        }

        // do not add entry if it already expired and `stale` option is false
        if ( !add ) return;

        entry = new CacheLruEntry( key, value, maxAge );

        this.#map.set( key, entry );
        this.#last = key;
    }

    delete ( key, { silent } = {} ) {
        const entry = this.#map.get( key );

        if ( !entry ) return;

        this.#delete( entry, silent );

        return entry.value;
    }

    // XXX clear
    reset ( { silent } = {} ) {
        if ( !silent && this.listenerCount( "delete" ) ) {
            for ( const entry of this.#map.values() ) this.#delete( entry );
        }

        this.#last = null;
        this.#map.clear();
    }

    prune ( { silent } = {} ) {
        for ( const entry of this.#map.values() ) {
            if ( entry.isStale ) this.#delete( entry, silent );
        }
    }

    // private
    #delete ( entry, silent ) {
        this.#map.delete( entry.key );
        if ( this.#last === entry.key ) this.#last = null;

        if ( !silent ) this.emit( "delete", entry.key, entry.value );
    }
}
