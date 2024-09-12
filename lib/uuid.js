import crypto from "node:crypto";

export default uuid;

export function uuid () {
    return crypto.randomUUID();
}

export function uuidToBuffer ( uuid ) {
    return Buffer.from( uuid.replaceAll( "-", "" ), "hex" );
}

export function uuidFromBuffer ( buffer, start = 0 ) {
    if ( ( start += buffer.length > 16 ) ) throw new Error( `UUID beffer length is not valid` );

    const hex = buffer.toString( "hex", start, start + 16 );

    return `${ hex.substring( 0, 8 ) }-${ hex.substring( 8, 12 ) }-${ hex.substring( 12, 16 ) }-${ hex.substring( 16, 20 ) }-${ hex.substring( 20 ) }`;
}
