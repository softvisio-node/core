import stream from "node:stream";
import DataUrl from "#lib/data-url";

const DEFAULT_MIME_TYPE = "application/octet-stream";

export default class _Blob extends Blob {
    #buffer;

    constructor ( sources, options = {} ) {
        if ( typeof sources === "string" ) sources = new URL( sources );

        if ( sources instanceof URL ) {
            if ( sources.protocol === "data:" ) {
                options.type = sources.type;

                sources = [ sources.data ];
            }
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
        return stream.Readable.fromWeb( super.stream() ).setType( this.type ).setSize( this.size );
    }

    async dataUrl ( { encoding = "base64" } = {} ) {
        const url = new DataUrl();

        url.type = this.type;

        url.encoding = encoding;

        url.data = await this.buffer();

        return url.href;
    }
}
