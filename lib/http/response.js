import "#lib/result";
import FileStream from "#lib/file-stream";
import Headers from "#lib/http/headers";
import stream from "#lib/stream";
import StreamFormData from "#lib/stream/form-data";

export default class Response extends result.Result {
    #response;
    #headers;
    #body;
    #formData;
    #stream;

    constructor ( response ) {
        super( [ response.status, response.statusText ] );

        this.#response = response;
    }

    // properties
    get url () {
        return this.#response.url;
    }

    get headers () {
        this.#headers ??= new Headers( this.#response.headers );

        return this.#headers;
    }

    get hasBody () {
        return !!this.#response.body;
    }

    get bodyUsed () {
        return this.#response.bodyUsed;
    }

    get body () {
        if ( !this.#body ) {
            if ( this.#response.body ) {
                this.#body = stream.Readable.fromWeb( this.#response.body );
            }
            else {
                this.#body = stream.Readable.from( "", {
                    "objectMode": false,
                } );
            }
        }

        return this.#body;
    }

    get redirected () {
        return this.#response.redirected;
    }

    get type () {
        return this.#response.type;
    }

    get cookies () {
        return this.#response.cookies;
    }

    get formData () {
        if ( !this.#formData ) {
            this.#formData = new StreamFormData( this.headers.contentType?.boundary );

            stream.pipeline( this.body, this.#formData, () => {} );
        }

        return this.#formData;
    }

    // public
    async arrayBuffer ( { maxLength } = {} ) {
        return this.body.arrayBuffer( { maxLength } );
    }

    async blob ( { maxLength, type } = {} ) {
        return this.body.blob( { maxLength, "type": type || this.headers.get( "content-type" ) } );
    }

    async buffer ( { maxLength } = {} ) {
        return this.body.buffer( { maxLength } );
    }

    async json ( { maxLength } = {} ) {
        return this.body.json( { maxLength } );
    }

    async tmpFile ( options = {} ) {
        if ( options.type === undefined && this.headers.get( "content-type" ) ) {
            options = {
                ...options,
                "type": this.headers.get( "content-type" ),
            };
        }

        return this.body.tmpFile( options );
    }

    async text ( { maxLength, encoding } = {} ) {
        return this.body.text( { maxLength, encoding } );
    }

    stream ( { name, type } = {} ) {
        if ( !this.#stream ) {
            this.#stream = new FileStream( this.body, {
                name,
                "type": type === undefined
                    ? this.headers.get( "content-type" )
                    : type,
                "size": this.headers.contentLength,
            } );
        }

        return this.#stream;
    }
}
