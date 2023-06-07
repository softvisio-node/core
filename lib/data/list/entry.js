export default class DoublyLinkedListEntry {
    value;
    list;
    previousEntry;
    nextEntry;

    constructor ( value ) {
        this.value = value;
    }

    // properties
    get isFirst () {
        return !this.previousEntry;
    }

    get isLast () {
        return !this.nextEntry;
    }

    // public
    delete () {
        this.list?.delete( this );
    }
}
