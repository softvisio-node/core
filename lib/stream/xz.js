import stream from "node:stream";
import xz from "xz-decompress";

export function createXzStreamDecompressor ( readableStream ) {
    if ( readableStream instanceof stream.Readable ) {
        readableStream = stream.Readable.toWeb( readableStream );
    }
    else if ( Buffer.isBuffer( readableStream ) ) {
        readableStream = new Blob( [ readableStream ] ).stream();
    }

    return stream.Readable.fromWeb( new xz.XzReadableStream( readableStream ) );
}
