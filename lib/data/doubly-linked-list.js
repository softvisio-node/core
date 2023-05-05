import DoublyLinkedListEntry from "#lib/data/doubly-linked-list/entry";

export default class DoublyLinkedList {
    #length = 0;
    #firstEntry = null;
    #lastEntry = null;

    // properties
    get length () {
        return this.#length;
    }

    get firstEntry () {
        return this.#firstEntry;
    }

    get lastEntry () {
        return this.#lastEntry;
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

        if ( this.#lastEntry ) {
            entry.previousEntry = this.#lastEntry;
            this.#lastEntry.next = entry;
        }

        this.#lastEntry = entry;
        this.#firstEntry ||= entry;

        this.#length++;

        return entry;
    }

    pop () {
        if ( !this.#lastEntry ) return;

        const entry = this.#lastEntry;

        this.#lastEntry = entry.previousEntry;

        if ( this.#lastEntry ) {
            this.#lastEntry.next = null;
        }
        else {
            this.#firstEntry = null;
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

        if ( this.#firstEntry ) {
            entry.next = this.#firstEntry;
            this.#firstEntry.previousEntry = entry;
        }

        this.#firstEntry = entry;
        this.#lastEntry ||= entry;

        this.#length++;

        return entry;
    }

    shift () {
        if ( !this.#firstEntry ) return;

        const entry = this.#firstEntry;

        this.#firstEntry = entry.next;

        if ( this.#firstEntry ) {
            this.#firstEntry.previousEntry = null;
        }
        else {
            this.#lastEntry = null;
        }

        this.#length--;

        return entry;
    }

    delete ( entry ) {
        if ( !entry.list ) return;

        if ( entry.list !== this ) throw Error( `Unable to delete entry` );

        const previousEntry = entry.previousEntry,
            next = entry.next;

        if ( previousEntry ) {
            previousEntry.next = next;
        }

        if ( next ) {
            next.previousEntry = previousEntry;
        }

        if ( entry === this.#firstEntry ) this.#firstEntry = next;

        if ( entry === this.#lastEntry ) this.#lastEntry = previousEntry;

        entry.list = null;
        entry.previousEntry = null;
        entry.next = null;

        this.#length--;

        return this;
    }

    clear () {
        this.#length = 0;
        this.#firstEntry = null;
        this.#lastEntry = null;
    }

    *[Symbol.iterator] () {
        var entry = this.#firstEntry;

        while ( entry ) {
            const next = entry.next;

            yield entry;

            entry = next;
        }
    }

    *reverse () {
        var entry = this.#lastEntry;

        while ( entry ) {
            const previousEntry = entry.previousEntry;

            yield entry;

            entry = previousEntry;
        }
    }
}
