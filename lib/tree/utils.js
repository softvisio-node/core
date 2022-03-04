export function loadRecursive ( parent, keys, values, start, end ) {
    const size = end - start;
    if ( size > 0 ) {
        const middle = start + Math.floor( size / 2 );
        const key = keys[middle];
        const data = values[middle];
        const node = { key, data, parent };
        node.left = loadRecursive( node, keys, values, start, middle );
        node.right = loadRecursive( node, keys, values, middle + 1, end );
        return node;
    }
    return null;
}

export function markBalance ( node ) {
    if ( node === null ) return 0;
    const lh = markBalance( node.left );
    const rh = markBalance( node.right );

    node.balanceFactor = lh - rh;
    return Math.max( lh, rh ) + 1;
}

export function sort ( keys, values, left, right, compare ) {
    if ( left >= right ) return;

    const pivot = keys[( left + right ) >> 1];
    let i = left - 1;
    let j = right + 1;

    while ( true ) {
        do i++;
        while ( compare( keys[i], pivot ) < 0 );
        do j--;
        while ( compare( keys[j], pivot ) > 0 );
        if ( i >= j ) break;

        let tmp = keys[i];
        keys[i] = keys[j];
        keys[j] = tmp;

        tmp = values[i];
        values[i] = values[j];
        values[j] = tmp;
    }

    sort( keys, values, left, j, compare );
    sort( keys, values, j + 1, right, compare );
}
