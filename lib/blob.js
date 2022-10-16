import stream from "node:stream";
import { parseDataUrl, createDataUrl } from "#lib/data-url";

const DEFAULT_MIME_TYPE = "application/octet-stream";

export default class _Blob extends Blob {
    #buffer;

    constructor ( sources, options = {} ) {
        if ( typeof sources === "string" ) sources = new URL( sources );

        if ( sources instanceof URL ) {
            const dataUrl = parseDataUrl( sources );

            options.type = dataUrl.type;
            sources = [dataUrl.data];
        }

        super( sources, options );
    }

    // static
    static new ( data, options ) {
        if ( data instanceof this ) return data;

        return new this.constrictor( data, options );
    }

    // properties
    get defaultType () {
        return DEFAULT_MIME_TYPE;
    }

    // public
    async buffer () {
        this.#buffer ??= Buffer.from( await this.arrayBuffer() );

        return this.#buffer;
    }

    stream () {
        return stream.Readable.fromWeb( super.stream() );
    }

    async dataUrl ( { encoding = "base64" } = {} ) {
        return createDataUrl( {
            "type": this.type,
            "data": await this.buffer(),
            encoding,
        } );
    }
}
