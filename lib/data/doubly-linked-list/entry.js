export default class DoublyLinkedListEntry {
    value;
    list;
    previousEntry;
    next;

    constructor ( value ) {
        this.value = value;
    }

    // properties
    get isFirst () {
        return !this.previousEntry;
    }

    get isLast () {
        return !this.next;
    }

    // public
    delete () {
        this.list?.delete( this );
    }
}
