import Blob from "#lib/blob";
import fs from "#lib/fs";
import path from "path";
import mime from "#lib/mime";
import Stream from "stream";

const DEFAULT_MIME_TYPE = "application/octet-stream";

export default class File extends Blob {
    #name;
    #type;
    #size;
    #path;
    #lastModifiedDate;
    #stream;

    static new ( options ) {
        if ( options instanceof File ) return options;

        return new this( options );
    }

    constructor ( options = {} ) {
        super();

        this.#name = options.name;
        this.#type = options.type;
        this.#size = options.size;
        this.#path = options.path;

        if ( options.data != null ) this.data = options.data;
    }

    set data ( value ) {
        if ( value instanceof Stream ) {
            this.#stream = value;
        }
        else {
            super.data = value;
        }
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

        this.#type = null;
    }

    get type () {
        if ( this.#type == null ) {
            const mimeType = mime.getByFilename( this.name );

            if ( mimeType ) this.#type = mimeType.type;
            else this.#type = DEFAULT_MIME_TYPE;
        }

        return this.#type;
    }

    set type ( value ) {
        this.#type = value;
    }

    get size () {
        if ( super.data ) {
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
        if ( !super.data ) await this.#readStream();

        return super.data;
    }

    async text ( encoding ) {
        return ( await this.buffer() ).toString( encoding || "utf8" );
    }

    stream () {
        if ( this.#stream ) return this.#stream;
        else if ( super.data ) return super.stream();
        else if ( this.#path ) return fs.createReadStream( this.#path + "" );
    }

    // private
    #readStat () {
        if ( this.#path && fs.existsSync( this.#path ) ) {
            const stat = fs.statSync( this.#path );

            this.#lastModifiedDate = stat.mtime;
            this.#size = stat.size;
        }
    }

    async #readStream () {
        const stream = this.stream();

        if ( !stream ) return;

        return new Promise( resolve => {
            const buffers = [];

            stream.on( "data", buffers.push.bind( buffers ) );

            stream.on( "end", () => {
                if ( buffers.length === 0 ) this.data = Buffer.allocUnsafe( 0 );
                else if ( buffers.length === 1 ) this.data = buffers[0];
                else this.data = Buffer.concat( buffers );

                this.#stream = null;

                resolve();
            } );
        } );
    }
}
