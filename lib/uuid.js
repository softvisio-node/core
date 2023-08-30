import crypto from "node:crypto";

export default uuidV4;

export function uuidV4 () {
    return crypto.randomUUID();
}

export function uuidToBuffer ( uuid ) {
    return Buffer.from( uuid.replaceAll( "-", "" ), "hex" );
}

export function bufferToUuid ( buffer, start = 0 ) {
    const hex = buffer.toString( "hex", start, start + 16 );

    return `${hex.substring( 0, 8 )}-${hex.substring( 8, 12 )}-${hex.substring( 12, 16 )}-${hex.substring( 16, 20 )}-${hex.substring( 20 )}`;
}
