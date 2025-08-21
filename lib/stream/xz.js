import stream from "node:stream";
import xz from "xz-decompress";

export class XzReadableStream extends xz.XzReadableStream {
    constructor ( readableStream ) {
        if ( readableStream instanceof stream.Readable ) {
            super( stream.Readable.toWeb( readableStream ) );
        }
        else if ( Buffer.isBuffer( readableStream ) ) {
            super( new Blob( [ readableStream ] ).stream() );
        }
        else {
            super( readableStream );
        }
    }
}

export function createXzReadStream ( readableStream ) {
    return stream.Reafable.fromWeb( new XzReadableStream( readableStream ) );
}
