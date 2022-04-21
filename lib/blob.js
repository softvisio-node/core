import stream from "#lib/stream";

const DEFAULT_MIME_TYPE = "application/octet-stream";

export default class _Blob extends Blob {

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
        return Buffer.from( await this.arrayBuffer() );
    }

    stream () {
        return stream.Readable.fromWeb( super.stream() );
    }
}
