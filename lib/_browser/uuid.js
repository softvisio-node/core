export default uuidv4;

export function uuidv4 () {

    // fore https context use built-in method
    if ( crypto.randomUUID ) return crypto.randomUUID();

    // fallback for insecure context
    const hex = [ ...crypto.getRandomValues( new Uint8Array( 16 ) ) ].map( i => i.toString( 16 ).padStart( 2, "0" ) );

    hex.splice( 4, 0, "-" );
    hex.splice( 7, 0, "-" );
    hex.splice( 10, 0, "-" );
    hex.splice( 13, 0, "-" );

    return hex.join( "" );
}
