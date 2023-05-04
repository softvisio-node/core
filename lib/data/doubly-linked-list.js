import DoublyLinkedListEntry from "#lib/data/doubly-linked-list/entry";

export default class DoublyLinkedList {
    #length = 0;
    #first = null;
    #last = null;

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
    push ( value ) {
        var entry;

        if ( value instanceof DoublyLinkedListEntry ) {
            entry = value;

            entry.delete();
        }
        else {
            entry = new DoublyLinkedListEntry( value );
        }

        entry.list = this;

        if ( this.#last ) {
            entry.prev = this.#last;
            this.#last.next = entry;
        }

        this.#last = entry;
        this.#first ||= entry;

        this.#length++;

        return entry;
    }

    pop () {
        if ( !this.#last ) return;

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

    unshift ( value ) {
        var entry;

        if ( value instanceof DoublyLinkedListEntry ) {
            entry = value;

            entry.delete();
        }
        else {
            entry = new DoublyLinkedListEntry( value );
        }

        entry.list = this;

        if ( this.#first ) {
            entry.next = this.#first;
            this.#first.prev = entry;
        }

        this.#first = entry;
        this.#last ||= entry;

        this.#length++;

        return entry;
    }

    shift () {
        if ( !this.#first ) return;

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

    delete ( entry ) {
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

        return this;
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

            yield entry;

            entry = next;
        }
    }

    *reverse () {
        var entry = this.#last;

        while ( entry ) {
            const prev = entry.prev;

            yield entry;

            entry = prev;
        }
    }
}
