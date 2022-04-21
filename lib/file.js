import fs from "fs";
import path from "path";
import mime from "#lib/mime";
import stream from "stream";

const DEFAULT_MIME_TYPE = "application/octet-stream";

export default class File {
    #path;
    #name;
    #type;
    #size;
    #content;
    #lastModifiedDate;
    #typeChecked;

    #stream;

    constructor ( { path, name, type, size, content } = {} ) {
        this.#path = path;
        this.#name = name;
        this.#type = type;
        this.#size = size;

        if ( content == null ) {
            if ( !this.#path ) this.#content = Buffer.from();
        }
        else if ( content instanceof stream.Readable || Buffer.isBuffer( content ) ) {
            this.#content = content;
        }
        else {
            this.#content = Buffer.from( content );
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
        if ( this.#size == null ) {
            if ( Buffer.isBuffer( this.#content ) ) {
                this.#size = this.#content.length;
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
        var buffer;

        if ( this.#content == null ) {
            buffer = fs.readFileSync( this.#path + "" );
        }
        else if ( Buffer.isBuffer( this.#content ) ) {
            buffer = this.#content;
        }
        else if ( this.#content instanceof stream.Readable ) {
            throw Error( `Unable to serialize stream to JSON` );
        }

        return {
            "filename": this.name,
            "url": "data:" + this.type + ";base64," + buffer.toString( "base64" ),
        };
    }

    async buffer () {
        if ( this.#content == null ) {
            return fs.readFileSync( this.#path + "" );
        }
        else if ( Buffer.isBuffer( this.#content ) ) {
            return this.#content;
        }
        else if ( this.#content instanceof stream.Readable ) {
            this.#content = await this.#content.buffer();

            return this.#content;
        }
    }

    async text ( encoding ) {
        const buffer = await this.buffer();

        return buffer.toString( encoding || "utf8" );
    }

    stream () {
        if ( this.#content == null ) {
            return fs.createReadStream( this.#path + "" );
        }
        else if ( Buffer.isBuffer( this.#content ) ) {
            return stream.Readable.from( this.#content, { "objectMode": false } );
        }
        else if ( this.#content instanceof stream.Readable ) {
            return this.#content;
        }
    }

    async dataUrl () {
        const buffer = await this.buffer();

        return "data:" + this.type + ";base64," + buffer.toString( "base64" );
    }

    async json () {
        const buffer = await this.buffer();

        return {
            "filename": this.name,
            "url": "data:" + this.type + ";base64," + buffer.toString( "base64" ),
        };
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
