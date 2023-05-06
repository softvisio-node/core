import Events from "#lib/events";
import DoubleLinkedList from "#lib/data/doubly-linked-list";
import CacheLruEntry from "#lib/cache/lru/entry";

export default class CacheLru {
    #maxSize;
    #maxAge;

    #list = new DoubleLinkedList();
    #map = new Map();
    #events = new Events();

    constructor ( { maxSize, maxAge } = {} ) {
        this.#setMaxSize( maxSize );
        this.#setMaxAge( maxAge );
    }

    // properties
    get maxSize () {
        return this.#maxSize;
    }

    set maxSize ( value ) {
        if ( !this.#setMaxSize( value ) ) return;

        this.#events.emit( "option", "maxSize" );

        if ( this.#maxSize ) {
            while ( this.#map.size > this.#maxSize ) {
                this.#delete( this.#list.firstEntry );
            }
        }
    }

    get maxAge () {
        return this.#maxAge;
    }

    set maxAge ( value ) {
        if ( !this.#setMaxAge( value ) ) return;

        this.#events.emit( "option", "maxAge" );
    }

    get size () {
        return this.#map.size;
    }

    // public
    has ( key ) {
        const listEntry = this.#map.get( key );

        if ( !listEntry ) return false;

        if ( listEntry.value.isExpired ) {
            this.#delete( listEntry, true );

            return false;
        }
        else {
            return true;
        }
    }

    get ( key, { silent } = {} ) {
        const listEntry = this.#map.get( key );

        if ( !listEntry ) return;

        // entry is expired
        if ( listEntry.value.isExpired ) {

            // delete entry
            this.#delete( listEntry );
        }

        // entry is not expired
        else {

            // move key to the top of the cache
            if ( !silent ) this.#list.push( listEntry );

            // return value
            return listEntry.value.value;
        }
    }

    set ( key, value, maxAge ) {
        if ( maxAge == null ) {
            maxAge = this.#maxAge;
        }
        else if ( !Number.isInteger( maxAge ) ) {
            throw TypeError( `Max age should be a number` );
        }

        const add = !maxAge || maxAge > 0;

        var listEntry = this.#map.get( key );

        // key is exists
        if ( listEntry ) {

            // delete old entry, emit "delete" event if not add
            this.#delete( listEntry, add );
        }

        // key is not exists, cache size limit reached
        else if ( add && this.#maxSize && this.#map.size >= this.#maxSize ) {

            // remove first cached entry
            this.#delete( this.#list.firstEntry );
        }

        // do not add entry if it was expired
        if ( !add ) return;

        const cacheEntry = new CacheLruEntry( key, value, maxAge );

        listEntry = this.#list.push( cacheEntry );

        this.#map.set( key, listEntry );
    }

    delete ( key, { silent } = {} ) {
        const listEntry = this.#map.get( key );

        if ( !listEntry ) return;

        this.#delete( listEntry, silent );

        return listEntry.value.value;
    }

    clear ( { silent } = {} ) {
        this.#map = new Map();

        const list = this.#list;
        this.#list = new DoubleLinkedList();

        if ( !silent && this.#events.listenerCount( "delete" ) ) {
            for ( const listEntry of list ) {
                this.#events.emit( "delete", listEntry.value.key, listEntry.value.value );
            }
        }
    }

    prune ( { silent } = {} ) {
        for ( const listEntry of this.#list ) {
            if ( listEntry.value.isExpired ) this.#delete( listEntry, silent );
        }
    }

    on ( name, listener ) {
        this.#events.on( name, listener );

        return this;
    }

    once ( name, listener ) {
        this.#events.once( name, listener );

        return this;
    }

    off ( name, listener ) {
        this.#events.off( name, listener );

        return this;
    }

    // protected
    _getListEntry ( key ) {
        const listEntry = this.#map.get( key );

        if ( listEntry && listEntry.value.isExpired ) this.#delete( listEntry, true );

        return listEntry;
    }

    // private
    #setMaxSize ( value ) {
        if ( !value || value === Infinity ) {
            value = null;
        }
        else if ( !Number.isInteger( value ) || value < 0 ) {
            throw TypeError( `CacheLru maxSize value is invalid` );
        }

        // not updated
        if ( value === this.#maxSize ) return;

        this.#maxSize = value;

        return true;
    }

    #setMaxAge ( value ) {
        if ( !value || value === Infinity ) {
            value = null;
        }
        else if ( !Number.isInteger( value ) || value < 0 ) {
            throw TypeError( `CacheLru maxSize value is invalid` );
        }

        // not updated
        if ( value === this.#maxAge ) return;

        this.#maxAge = value;
    }

    #delete ( listEntry, silent ) {
        this.#map.delete( listEntry.value.key );

        listEntry.delete();

        if ( !silent ) this.#events.emit( "delete", listEntry.value.key, listEntry.value.value );
    }
}
