import Blob from "#lib/blob";
import fs from "#lib/fs";
import path from "path";
import mime from "#lib/db/mime";

export default class File extends Blob {
    #name;
    #type;
    #size;
    #path;
    #lastModifiedDate;
    #stream;

    static new ( options ) {
        if ( options instanceof File ) return options;

        return new File( options );
    }

    constructor ( options = {} ) {
        super();

        this.#name = options.name;
        this.#type = options.type;
        this.#size = options.size;
        this.#path = options.path;

        if ( options.buffer != null ) this.setBuffer( options.buffer );
        else this.#stream = options.stream;
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

    get type () {
        if ( this.#type == null ) {
            const type = mime.getByFilename( this.name );

            if ( type ) this.#type = type["content-type"];
            else this.#type = "application/octet-stream";
        }

        return this.#type;
    }

    get size () {
        if ( this.getBuffer() ) return super.size;
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
        if ( !this.getBuffer() ) await this.#readStream();

        return this.getBuffer();
    }

    stream () {
        if ( this.#stream ) return this.#stream;
        else if ( this.getBuffer() ) return super.stream();
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
                if ( buffers.length === 0 ) this.setBuffer( Buffer.allocUnsafe( 0 ) );
                else if ( buffers.length === 1 ) this.setBuffer( buffers[0] );
                else this.setBuffer( Buffer.concat( buffers ) );

                this.#stream = null;

                resolve();
            } );
        } );
    }
}
