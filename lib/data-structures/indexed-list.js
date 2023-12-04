import List from "#lib/data-structures/list";
import ListEntry from "#lib/data-structures/list/entry";

export default class IndexedList extends List {
    #index = new Map();

    // public
    has ( value ) {
        if ( value instanceof ListEntry ) {
            return this.#index.has( value.value );
        }
        else {
            return this.#index.has( value );
        }
    }

    get ( value ) {
        if ( value instanceof ListEntry ) {
            return this.#index.get( value.value );
        }
        else {
            return this.#index.get( value );
        }
    }

    keys () {
        return this.#index.keys();
    }

    push ( value ) {
        const entry = super.push( value );

        this.#index.set( entry.value, entry );

        return entry;
    }

    pop () {
        const entry = super.pop();

        if ( entry ) this.#index.delete( entry.value );

        return entry;
    }

    unshift ( value ) {
        const entry = super.unshift( value );

        this.#index.set( entry.value, entry );

        return entry;
    }

    shift () {
        const entry = super.shift();

        if ( entry ) this.#index.delete( entry.value );

        return entry;
    }

    delete ( value ) {
        var entry;

        if ( value instanceof ListEntry ) {
            entry = value;
        }
        else {
            entry = this.#index.get( value );
        }

        if ( entry ) {
            super.delete( entry );

            this.#index.delete( entry.value );
        }

        return this;
    }

    clear () {
        this.#index.clear();

        return super.clear();
    }
}
