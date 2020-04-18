export async function sleep ( timeout ) {
    return new Promise( ( resolve ) => setTimeout( resolve, timeout ) );
}

export function say () {
    console.log( arguments );
}
