import DoublyLinkedListEntry from "#lib/data/doubly-linked-list/entry";

export default class DoublyLinkedList {
    #length = 0;
    #first = null;
    #last = null;

    //  static
    static get Entry () {
        return DoublyLinkedListEntry;
    }

    // properties
    get length () {
        return this.#length;
    }

    get first () {
        return this.#first;
    }

    get last () {
        return this.#last;
    }

    // public
    unshift ( ...values ) {
        for ( const value of values ) {
            const entry = new this.constructor.Entry( value );

            this.unshiftEntry( entry );
        }
    }

    push ( ...values ) {
        for ( const value of values ) {
            const entry = new this.constructor.Entry( value );

            this.pushEntry( entry );
        }
    }

    shift () {
        return this.shiftEntry()?.value;
    }

    pop () {
        return this.popEntry()?.value;
    }

    clear () {
        this.#length = 0;
        this.#first = null;
        this.#last = null;
    }

    *[Symbol.iterator] () {
        var entry = this.#first;

        while ( entry ) {
            const next = entry.next;

            yield entry.value;

            entry = next;
        }
    }

    unshiftEntry ( ...values ) {
        for ( const entry of values ) {
            entry.delete();

            entry.list = this;

            if ( this.#first ) {
                entry.next = this.#first;
                this.#first.prev = entry;
            }

            this.#first = entry;

            this.#last ||= entry;

            this.#length++;
        }
    }

    pushEntry ( ...values ) {
        for ( const entry of values ) {
            entry.delete();

            entry.list = this;

            if ( this.#last ) {
                entry.prev = this.#last;
                this.#last.next = entry;
            }

            this.#last = entry;

            this.#first ||= entry;

            this.#length++;
        }
    }

    shiftEntry () {
        if ( !this.#first ) return undefined;

        const entry = this.#first;

        this.#first = entry.next;

        if ( this.#first ) {
            this.#first.prev = null;
        }
        else {
            this.#last = null;
        }

        this.#length--;

        return entry;
    }

    popEntry () {
        if ( !this.#last ) return undefined;

        const entry = this.#last;

        this.#last = entry.prev;

        if ( this.#last ) {
            this.#last.next = null;
        }
        else {
            this.#first = null;
        }

        this.#length--;

        return entry;
    }

    deleteEntry ( entry ) {
        if ( !entry.list ) return;

        if ( entry.list !== this ) throw Error( `Unable to delete entry` );

        const prev = entry.prev,
            next = entry.next;

        if ( prev ) {
            prev.next = next;
        }

        if ( next ) {
            next.prev = prev;
        }

        if ( entry === this.#first ) this.#first = next;

        if ( entry === this.#last ) this.#last = prev;

        entry.list = null;
        entry.prev = null;
        entry.next = null;

        this.#length--;

        return next;
    }

    forEachEntry ( callback, _this ) {
        var entry = this.#first,
            index = 0;

        while ( entry ) {
            const next = entry.next;

            callback.call( _this, entry, index, this );

            index++;

            entry = next;
        }
    }

    forEachEntryReverse ( callback, _this ) {
        var entry = this.#last,
            index = this.length - 1;

        while ( entry ) {
            const prev = entry.prev;

            callback.call( _this, entry, index, this );

            index--;

            entry = prev;
        }
    }
}
