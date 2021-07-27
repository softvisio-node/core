import Blob from "#lib/blob";
import fs from "#lib/fs";
import path from "path";
import mime from "#lib/mime";
import stream from "stream";

const DEFAULT_MIME_TYPE = "application/octet-stream";

export default class File extends Blob {
    #name;
    #size;
    #path;
    #lastModifiedDate;
    #stream;

    static new ( options ) {
        if ( options instanceof File ) return options;

        return new this( options );
    }

    constructor ( options = {} ) {
        super( options.content, options );

        this.#path = options.path;
        this.#name = options.name;
        this.#size = options.size;
    }

    get lastModified () {
        if ( this.lastModifiedDate ) return this.lastModifiedDate.getTime();
        else return null;
    }

    get lastModifiedDate () {
        if ( this.#lastModifiedDate == null ) this.#readStat();

        return this.#lastModifiedDate;
    }

    get name () {
        if ( this.#name == null && this.#path != null ) this.#name = path.basename( this.#path );

        return this.#name;
    }

    set name ( value ) {
        this.#name = value;

        super.type = null;
    }

    get type () {
        if ( super.type == null ) {
            const mimeType = mime.getByFilename( this.name );

            if ( mimeType ) super.type = mimeType.type;
            else super.type = DEFAULT_MIME_TYPE;
        }

        return super.type;
    }

    set type ( value ) {
        super.type = value;
    }

    get size () {
        if ( super.getContent() ) {
            return super.size;
        }
        else {
            if ( this.#size == null ) this.#readStat();

            return this.#size;
        }
    }

    get path () {
        return this.#path;
    }

    // public
    async buffer () {
        var buffer = super.getContent();

        // buffer is cached
        if ( buffer ) return buffer;

        if ( this.#stream ) {
            this.setContent( await stream.buffer() );
        }
        else if ( this.#path ) {
            return fs.readFileSync( this.#path );
        }
    }

    stream () {
        if ( super.getContent() ) return super.stream();
        else if ( this.#stream ) return this.#stream;
        else if ( this.#path ) return fs.createReadStream( this.#path + "" );
    }

    setContent ( value ) {
        if ( value instanceof stream.Readable ) {
            this.#stream = value;
        }
        else {
            super.setContent( value );
        }
    }

    // private
    #readStat () {
        if ( this.#path && fs.existsSync( this.#path ) ) {
            const stat = fs.statSync( this.#path );

            this.#lastModifiedDate = stat.mtime;
            this.#size = stat.size;
        }
    }
}
