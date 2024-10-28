# Doubly linked list

<https://en.wikipedia.org/wiki/Doubly_linked_list>

```javascript
import DoublyLinkedList from "@softvisio/utils/doubly-linked-list";

const list = new DoublyLinkedList();

list.push(1, 2, 3);
```

## Class: DoublyLinkedList

### new DoublyLinkedList()

-   Returns: {DoublyLinkedList}.

### DoublyLinkedList.Node

-   Returns: {DoublyLinkedListNode}.

### list.length

-   Returns: {integer} List length.

### list.first

-   Returns: {DoublyLinkedListNode} First list node.

### list.last

-   Returns: {DoublyLinkedListNode} Last list node.

### list.push( ...values )

-   `...values` {any} Values to push.

### list.unshift( ...values )

-   `...values` {any} Values to unshift.

### list.shift()

-   Returns: {any} Shift first node and returns it value.

### list.pop()

-   Returns: {any} Remove last node and returns it value.

### list.delete( node )

-   `node` {DoublyLinkedListNode} Node to delete.

### list.forEachNode( callback, this? )

-   `callback` {Function}:
    -   `node` {DoublyLinkedListNode}.
    -   `index` {integer} Node index.
    -   `list` {DoublyLinkedList} This list.
-   `this?` {any} Callback `this` context to set.

### list.forEachNodeReverse( callback, this? )

-   `callback` {Function}:
    -   `node` {DoublyLinkedListNode}.
    -   `index` {integer} Node index.
    -   `list` {DoublyLinkedList} This list.
-   `this?` {any} Callback `this` context to set.

## Class: DoublyLinkedListNode

### new DoublyLinkedListNode( value )

-   `value` {any} Value, associated with the node.
-   Returns: {DoublyLinkedListNode}.

### node.value

-   Returns: {any} Node value.

### node.list

-   Returns: {DoublyLinkedList} List, this node belongs to.

### node.prev

-   Returns: {DoublyLinkedListNode} Previous node.

### node.next

-   Returns: {DoublyLinkedListNode} Next node.

### node.isFirst

-   Returns: {boolean} `true` if node is first.

### node.isLast

-   Returns: {boolean} `true` if node is last.

### node.delete()

Removes node from the list.
