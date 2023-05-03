class DoublyLinkedListNode {
    #value;
    #list;
    #prev;
    #next;

    constructor ( value ) {
        this.#value = value;
    }

    // properties
    get value () {
        return this.#value;
    }

    get list () {
        return this.#list;
    }

    set list ( list ) {
        this.#list = list;
    }

    get prev () {
        return this.#prev;
    }

    set prev ( node ) {
        this.#prev = node;
    }

    get next () {
        return this.#next;
    }

    set next ( node ) {
        this.#next = node;
    }

    get isFirst () {
        return !this.#prev;
    }

    get isLast () {
        return !this.#next;
    }

    // public
    delete () {
        if ( !this.#list ) return;

        this.#list.delete( this );
    }
}

export default class DoublyLinkedList {
    #length = 0;
    #first = null;
    #last = null;

    //  static
    static get Node () {
        return DoublyLinkedListNode;
    }

    // properties
    get first () {
        return this.#first;
    }

    get last () {
        return this.#last;
    }

    get length () {
        return this.#length;
    }

    // public
    delete ( node ) {
        if ( !node.list ) return;

        if ( node.list !== this ) throw Error( `Unable to delete node` );

        const prev = node.prev,
            next = node.next;

        if ( prev ) {
            prev.next = next;
        }

        if ( next ) {
            next.prev = prev;
        }

        if ( node === this.#first ) this.#first = next;

        if ( node === this.#last ) this.#last = prev;

        node.list = null;
        node.prev = null;
        node.next = null;

        this.#length--;

        return next;
    }

    unshift ( values ) {
        for ( const value of values ) {
            let node;

            if ( value instanceof DoublyLinkedListNode ) {
                node = value;

                node.delete();
            }
            else {
                node = new this.constructor.Node( value );
            }

            node.list = this;

            if ( this.#first ) {
                node.next = this.#first;
                this.#first.prev = node;
            }

            this.#first = node;

            this.#last ||= node;

            this.#length++;
        }
    }

    push ( ...values ) {
        for ( const value of values ) {
            let node;

            if ( value instanceof DoublyLinkedListNode ) {
                node = value;

                node.delete();
            }
            else {
                node = new this.constructor.Node( value );
            }

            node.list = this;

            if ( this.#last ) {
                node.prev = this.#last;
                this.#last.next = node;
            }

            this.#last = node;

            this.#first ||= node;

            this.#length++;
        }
    }

    shift () {
        if ( !this.#first ) return undefined;

        const node = this.#first;

        this.#first = node.next;

        if ( this.#first ) {
            this.#first.prev = null;
        }
        else {
            this.#last = null;
        }

        this.#length--;

        return node.value;
    }

    pop () {
        if ( !this.#last ) return undefined;

        const node = this.#last;

        this.#last = node.prev;

        if ( this.#last ) {
            this.#last.next = null;
        }
        else {
            this.#first = null;
        }

        this.#length--;

        return node.value;
    }

    *[Symbol.iterator] () {
        var node = this.#first;

        while ( node ) {
            const next = node.next;

            yield node.value;

            node = next;
        }
    }

    forEachNode ( callback, _this ) {
        var node = this.#first,
            index = 0;

        while ( node ) {
            const next = node.next;

            callback.call( _this, node, index, this );

            index++;

            node = next;
        }
    }

    forEachNodeReverse ( callback, _this ) {
        var node = this.#last,
            index = this.length - 1;

        while ( node ) {
            const prev = node.prev;

            callback.call( _this, node, index, this );

            index--;

            node = prev;
        }
    }
}
