import fs from "node:fs";
import path from "node:path";
import mime from "#lib/mime";
import stream from "mode:stream";
import url from "node:url";

const DEFAULT_MIME_TYPE = "application/octet-stream";

export default class File {
    #path;
    #name;
    #type;
    #size;
    #buffer;
    #lastModifiedDate;
    #typeChecked;

    #stream;

    constructor ( { path, name, type, content } = {} ) {
        this.#path = path;
        this.#name = name;
        this.#type = type;

        if ( this.#path instanceof URL ) this.#path = url.fileURLToPath( this.#path );

        if ( content != null ) {
            if ( Buffer.isBuffer( content ) ) {
                this.#buffer = content;
            }
            else {
                this.#buffer = Buffer.from( content );
            }
        }
    }

    // static
    static new ( options ) {
        if ( options instanceof File ) return options;

        return new this( options );
    }

    // properties
    get defaultType () {
        return DEFAULT_MIME_TYPE;
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

        this.#typeChecked = false;
        super.type = null;
    }

    get type () {
        if ( !this.#type && !this.#typeChecked ) {
            this.#typeChecked = true;

            const mimeType = mime.getByFilename( this.name );

            this.#type = mimeType?.type || null;
        }

        return this.#type;
    }

    set type ( value ) {
        this.#type = value;
    }

    get size () {
        if ( this.#size === undefined ) {
            if ( Buffer.isBuffer( this.#buffer ) ) {
                this.#size = this.#buffer.length;
            }
            else {
                this.#readStat();
            }
        }

        return this.#size;
    }

    get path () {
        return this.#path;
    }

    // public
    toJSON () {
        const buffer = this.#getBuffer();

        return {
            "filename": this.name,
            "url": "data:" + this.type + ";base64," + buffer.toString( "base64" ),
        };
    }

    async buffer () {
        return this.#getBuffer();
    }

    async text ( encoding ) {
        const buffer = await this.buffer();

        return buffer.toString( encoding || "utf8" );
    }

    stream ( { start, end } = {} ) {
        if ( this.#buffer ) {
            let buffer = this.#buffer;

            if ( start || end ) buffer = buffer.subarray( start, end );

            return stream.Readable.from( buffer, { "objectMode": false } );
        }
        else if ( this.#path && fs.existsSync( this.#path + "" ) ) {

            // make end inclusive
            if ( end ) end--;

            return fs.createReadStream( this.#path + "", { start, end } );
        }
        else {
            return null;
        }
    }

    async dataUrl () {
        const buffer = this.#getBuffer();

        return "data:" + this.type + ";base64," + buffer.toString( "base64" );
    }

    // private
    #readStat () {
        if ( this.#path && fs.existsSync( this.#path ) ) {
            const stat = fs.statSync( this.#path );

            this.#lastModifiedDate = stat.mtime;
            this.#size = stat.size;
        }
    }

    #getBuffer () {
        if ( this.#buffer ) {
            return this.#buffer;
        }
        else if ( this.#path && fs.existsSync( this.#path + "" ) ) {
            return fs.readFileSync( this.#path + "" );
        }
        else {
            return null;
        }
    }
}
