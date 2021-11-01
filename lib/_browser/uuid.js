export function v4 () {
    const hex = [...crypto.getRandomValues( new Uint8Array( 16 ) )].map( i => i.toString( 16 ).padStart( 2, "0" ) );

    hex.splice( 4, 0, "-" );
    hex.splice( 7, 0, "-" );
    hex.splice( 10, 0, "-" );
    hex.splice( 13, 0, "-" );

    return hex.join( "" );
}
