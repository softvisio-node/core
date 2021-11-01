export function v4 () {
    return crypto.getRandomValues( new Uint8Array( 16 ) ).join();
}
