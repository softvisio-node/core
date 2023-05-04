export default class DoublyLinkedListEntry {
    value;
    list;
    prev;
    next;

    constructor ( value ) {
        this.value = value;
    }

    // properties
    get isFirst () {
        return !this.prev;
    }

    get isLast () {
        return !this.next;
    }

    // public
    delete () {
        this.list?.delete( this );
    }
}
