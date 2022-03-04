import { loadRecursive, sort } from "./utils.js";

const DEFAULT_COMPARE = ( a, b ) => ( a > b ? 1 : a < b ? -1 : 0 );

export default class AvlTree {
    #comparator;
    #allowDuplicates;
    #root = null;
    #size = 0;

    constructor ( { comparator, allowDuplicates = true } = {} ) {
        this.#comparator = comparator || DEFAULT_COMPARE;
        this.#allowDuplicates = !!allowDuplicates;
    }

    // properties
    get size () {
        return this.#size;
    }

    get isEmpty () {
        return !this.#root;
    }

    // returns node with the minimum key
    get minNode () {
        var node = this.#root;

        if ( !node ) return null;

        while ( node.left ) node = node.left;

        return node;
    }

    // returns node with the max key
    get maxNode () {
        var node = this.#root;
        if ( !node ) return null;
        while ( node.right ) node = node.right;
        return node;
    }

    // min key
    get min () {
        var node = this.#root;
        if ( !node ) return null;
        while ( node.left ) node = node.left;
        return node.key;
    }

    // max key
    get max () {
        var node = this.#root;
        if ( !node ) return null;
        while ( node.right ) node = node.right;
        return node.key;
    }

    // public
    clear () {
        this.#root = null;
        this.#size = 0;
        return this;
    }

    has ( key ) {
        if ( this.#root ) {
            var node = this.#root;
            var comparator = this.#comparator;
            while ( node ) {
                var cmp = comparator( key, node.key );
                if ( cmp === 0 ) return true;
                else if ( cmp < 0 ) node = node.left;
                else node = node.right;
            }
        }
        return false;
    }

    next ( node ) {
        var successor = node;
        if ( successor ) {
            if ( successor.right ) {
                successor = successor.right;
                while ( successor.left ) successor = successor.left;
            }
            else {
                successor = node.parent;
                while ( successor && successor.right === node ) {
                    node = successor;
                    successor = successor.parent;
                }
            }
        }
        return successor;
    }

    previous ( node ) {
        var predecessor = node;
        if ( predecessor ) {
            if ( predecessor.left ) {
                predecessor = predecessor.left;
                while ( predecessor.right ) predecessor = predecessor.right;
            }
            else {
                predecessor = node.parent;
                while ( predecessor && predecessor.left === node ) {
                    node = predecessor;
                    predecessor = predecessor.parent;
                }
            }
        }
        return predecessor;
    }

    isBalanced ( node ) {
        return this.#isBalanced( node || this.#root );
    }

    forEach ( callback ) {
        var current = this.#root;
        var s = [],
            done = false,
            i = 0;

        while ( !done ) {

            // Reach the left most Node of the current Node
            if ( current ) {

                // Place pointer to a tree node on the stack
                // before traversing the node's left subtree
                s.push( current );
                current = current.left;
            }
            else {

                // BackTrack from the empty subtree and visit the Node
                // at the top of the stack; however, if the stack is
                // empty you are done
                if ( s.length > 0 ) {
                    current = s.pop();
                    callback( current, i++ );

                    // We have visited the node and its left
                    // subtree. Now, it's right subtree's turn
                    current = current.right;
                }
                else done = true;
            }
        }
        return this;
    }

    // walk key range from `low` to `high`. Stops if `fn` returns a value
    range ( low, high, fn, ctx ) {
        const Q = [];
        const compare = this.#comparator;
        let node = this.#root,
            cmp;

        while ( Q.length !== 0 || node ) {
            if ( node ) {
                Q.push( node );
                node = node.left;
            }
            else {
                node = Q.pop();
                cmp = compare( node.key, high );
                if ( cmp > 0 ) {
                    break;
                }
                else if ( compare( node.key, low ) >= 0 ) {
                    if ( fn.call( ctx, node ) ) return this; // stop if smth is returned
                }
                node = node.right;
            }
        }
        return this;
    }

    // returns all keys in order
    keys () {
        var current = this.#root;
        var s = [],
            r = [],
            done = false;

        while ( !done ) {
            if ( current ) {
                s.push( current );
                current = current.left;
            }
            else {
                if ( s.length > 0 ) {
                    current = s.pop();
                    r.push( current.key );
                    current = current.right;
                }
                else done = true;
            }
        }
        return r;
    }

    // returns values fields of all nodes in order
    values () {
        var current = this.#root;
        var s = [],
            r = [],
            done = false;

        while ( !done ) {
            if ( current ) {
                s.push( current );
                current = current.left;
            }
            else {
                if ( s.length > 0 ) {
                    current = s.pop();
                    r.push( current.data );
                    current = current.right;
                }
                else done = true;
            }
        }
        return r;
    }

    // returns node at given index
    at ( index ) {

        // removed after a consideration, more misleading than useful
        // index = index % this.size;
        // if (index < 0) index = this.size - index;

        var current = this.#root;
        var s = [],
            done = false,
            i = 0;

        while ( !done ) {
            if ( current ) {
                s.push( current );
                current = current.left;
            }
            else {
                if ( s.length > 0 ) {
                    current = s.pop();
                    if ( i === index ) return current;
                    i++;
                    current = current.right;
                }
                else done = true;
            }
        }
        return null;
    }

    pop () {
        var node = this.#root,
            returnValue = null;
        if ( node ) {
            while ( node.left ) node = node.left;
            returnValue = { "key": node.key, "data": node.data };
            this.delete( node.key );
        }
        return returnValue;
    }

    popMax () {
        var node = this.#root,
            returnValue = null;
        if ( node ) {
            while ( node.right ) node = node.right;
            returnValue = { "key": node.key, "data": node.data };
            this.delete( node.key );
        }
        return returnValue;
    }

    get ( key ) {
        const root = this.#root,
            compare = this.#comparator;

        // if (root === null)    return null;
        // if (key === root.key) return root;

        var subtree = root,
            cmp;

        while ( subtree ) {
            cmp = compare( key, subtree.key );

            if ( cmp === 0 ) return subtree;
            else if ( cmp < 0 ) subtree = subtree.left;
            else subtree = subtree.right;
        }

        return null;
    }

    /**
     * Insert a node into the tree
     * @param  {Key} key
     * @param  {Value} [data]
     * @return {?Node}
     */
    insert ( key, data ) {
        if ( !this.#root ) {
            this.#root = {
                "parent": null,
                "left": null,
                "right": null,
                "balanceFactor": 0,
                key,
                data,
            };
            this.#size++;
            return this.#root;
        }

        var compare = this.#comparator;
        var node = this.#root;
        var parent = null;
        var cmp = 0;

        if ( !this.#allowDuplicates ) {
            while ( node ) {
                cmp = compare( key, node.key );
                parent = node;
                if ( cmp === 0 ) return null;
                else if ( cmp < 0 ) node = node.left;
                else node = node.right;
            }
        }
        else {
            while ( node ) {
                cmp = compare( key, node.key );
                parent = node;
                if ( cmp <= 0 ) node = node.left;

                // return null;
                else node = node.right;
            }
        }

        var newNode = {
            "left": null,
            "right": null,
            "balanceFactor": 0,
            parent,
            key,
            data,
        };
        var newRoot;
        if ( cmp <= 0 ) parent.left = newNode;
        else parent.right = newNode;

        while ( parent ) {
            cmp = compare( parent.key, key );
            if ( cmp < 0 ) parent.balanceFactor -= 1;
            else parent.balanceFactor += 1;

            if ( parent.balanceFactor === 0 ) break;
            else if ( parent.balanceFactor < -1 ) {

                // inlined
                // var newRoot = rightBalance(parent);
                if ( parent.right.balanceFactor === 1 ) this.#rotateRight( parent.right );
                newRoot = this.#rotateLeft( parent );

                if ( parent === this.#root ) this.#root = newRoot;
                break;
            }
            else if ( parent.balanceFactor > 1 ) {

                // inlined
                // var newRoot = leftBalance(parent);
                if ( parent.left.balanceFactor === -1 ) this.#rotateLeft( parent.left );
                newRoot = this.#rotateRight( parent );

                if ( parent === this.#root ) this.#root = newRoot;
                break;
            }
            parent = parent.parent;
        }

        this.#size++;
        return newNode;
    }

    delete ( key ) {
        if ( !this.#root ) return null;

        var node = this.#root;
        var compare = this.#comparator;
        var cmp = 0;

        while ( node ) {
            cmp = compare( key, node.key );
            if ( cmp === 0 ) break;
            else if ( cmp < 0 ) node = node.left;
            else node = node.right;
        }
        if ( !node ) return null;

        var returnValue = node.key;
        var max, min;

        if ( node.left ) {
            max = node.left;

            while ( max.left || max.right ) {
                while ( max.right ) max = max.right;

                node.key = max.key;
                node.data = max.data;
                if ( max.left ) {
                    node = max;
                    max = max.left;
                }
            }

            node.key = max.key;
            node.data = max.data;
            node = max;
        }

        if ( node.right ) {
            min = node.right;

            while ( min.left || min.right ) {
                while ( min.left ) min = min.left;

                node.key = min.key;
                node.data = min.data;
                if ( min.right ) {
                    node = min;
                    min = min.right;
                }
            }

            node.key = min.key;
            node.data = min.data;
            node = min;
        }

        var parent = node.parent;
        var pp = node;
        var newRoot;

        while ( parent ) {
            if ( parent.left === pp ) parent.balanceFactor -= 1;
            else parent.balanceFactor += 1;

            if ( parent.balanceFactor < -1 ) {

                // inlined
                // var newRoot = rightBalance(parent);
                if ( parent.right.balanceFactor === 1 ) this.#rotateRight( parent.right );
                newRoot = this.#rotateLeft( parent );

                if ( parent === this.#root ) this.#root = newRoot;
                parent = newRoot;
            }
            else if ( parent.balanceFactor > 1 ) {

                // inlined
                // var newRoot = leftBalance(parent);
                if ( parent.left.balanceFactor === -1 ) this.#rotateLeft( parent.left );
                newRoot = this.#rotateRight( parent );

                if ( parent === this.#root ) this.#root = newRoot;
                parent = newRoot;
            }

            if ( parent.balanceFactor === -1 || parent.balanceFactor === 1 ) break;

            pp = parent;
            parent = parent.parent;
        }

        if ( node.parent ) {
            if ( node.parent.left === node ) node.parent.left = null;
            else node.parent.right = null;
        }

        if ( node === this.#root ) this.#root = null;

        this.#size--;
        return returnValue;
    }

    /**
     * Bulk-load items
     * @param  {Array<Key>}  keys
     * @param  {Array<Value>}  [values]
     * @return {AvlTree}
     */
    load ( keys = [], values = [], presort ) {
        if ( this.#size !== 0 ) throw Error( `Bulk-load: tree is not empty` );

        const size = keys.length;

        if ( presort ) sort( keys, values, 0, size - 1, this.#comparator );

        this.#root = loadRecursive( null, keys, values, 0, size );

        this.#markBalance( this.#root );

        this.#size = size;

        return this;
    }

    toString ( printNode = n => n.key ) {
        const out = [];

        this.#row( this.#root, "", true, v => out.push( v ), printNode );

        return out.join( "" );
    }

    // private
    #height ( node ) {
        return node ? 1 + Math.max( this.#height( node.left ), this.#height( node.right ) ) : 0;
    }

    #isBalanced ( root ) {
        if ( root === null ) return true; // If node is empty then return true

        // Get the height of left and right sub trees
        var lh = this.#height( root.left );
        var rh = this.#height( root.right );

        if ( Math.abs( lh - rh ) <= 1 && this.#isBalanced( root.left ) && this.#isBalanced( root.right ) ) return true;

        // If we reach here then tree is not height-balanced
        return false;
    }

    #row ( root, prefix, isTail, out, printNode ) {
        if ( root ) {
            out( `${prefix}${isTail ? "└── " : "├── "}${printNode( root )}\n` );

            const indent = prefix + ( isTail ? "    " : "│   " );

            if ( root.left ) this.#row( root.left, indent, false, out, printNode );

            if ( root.right ) this.#row( root.right, indent, true, out, printNode );
        }
    }

    #markBalance ( node ) {
        if ( node === null ) return 0;

        const lh = this.#markBalance( node.left ),
            rh = this.#markBalance( node.right );

        node.balanceFactor = lh - rh;

        return Math.max( lh, rh ) + 1;
    }

    #rotateLeft ( node ) {
        var rightNode = node.right;
        node.right = rightNode.left;

        if ( rightNode.left ) rightNode.left.parent = node;

        rightNode.parent = node.parent;
        if ( rightNode.parent ) {
            if ( rightNode.parent.left === node ) {
                rightNode.parent.left = rightNode;
            }
            else {
                rightNode.parent.right = rightNode;
            }
        }

        node.parent = rightNode;
        rightNode.left = node;

        node.balanceFactor += 1;
        if ( rightNode.balanceFactor < 0 ) {
            node.balanceFactor -= rightNode.balanceFactor;
        }

        rightNode.balanceFactor += 1;
        if ( node.balanceFactor > 0 ) {
            rightNode.balanceFactor += node.balanceFactor;
        }
        return rightNode;
    }

    #rotateRight ( node ) {
        var leftNode = node.left;
        node.left = leftNode.right;
        if ( node.left ) node.left.parent = node;

        leftNode.parent = node.parent;
        if ( leftNode.parent ) {
            if ( leftNode.parent.left === node ) {
                leftNode.parent.left = leftNode;
            }
            else {
                leftNode.parent.right = leftNode;
            }
        }

        node.parent = leftNode;
        leftNode.right = node;

        node.balanceFactor -= 1;
        if ( leftNode.balanceFactor > 0 ) {
            node.balanceFactor -= leftNode.balanceFactor;
        }

        leftNode.balanceFactor -= 1;
        if ( node.balanceFactor < 0 ) {
            leftNode.balanceFactor += node.balanceFactor;
        }

        return leftNode;
    }
}
