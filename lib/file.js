import fs from "node:fs";
import path from "node:path";
import mime from "#lib/mime";
import stream from "node:stream";
import _url from "node:url";
import { parseDataUrl, createDataUrl } from "#lib/data-url";

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

    constructor ( url ) {
        var path, name, type, content;

        if ( typeof url === "string" ) url = new URL( url );

        if ( url instanceof URL ) {
            if ( url.protocol === "data:" ) {
                const dataUrl = parseDataUrl( url );

                type = dataUrl.type;
                content = dataUrl.data;
                name = dataUrl.params.get( "name" );
                path = dataUrl.params.get( "path" );
            }
            else if ( url.protocol === "file:" ) {
                path = _url.fileURLToPath( url );
            }
            else {
                throw Error( `Only data: anf file: urls are supported` );
            }
        }
        else {
            ( { path, name, type, content } = url );
        }

        this.#path = path;
        this.#name = name;
        this.#type = type;

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
    toString () {
        return this.toJSON();
    }

    toJSON () {
        var type = this.type,
            params;

        if ( this.#path || this.#name ) {
            params = new URLSearchParams();

            if ( this.#path ) params.set( "path", this.#path );
            if ( this.#name ) params.set( "name", this.#name );
        }

        return createDataUrl( {
            type,
            "data": this.#buffer,
            "encoding": "base64",
            params,
        } );
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

    async dataUrl ( name ) {
        var params;

        if ( name && this.#name ) params = new URLSearchParams( { "name": this.#name } );

        return createDataUrl( {
            "type": this.type,
            "data": await this.#getBuffer(),
            "encoding": "base64",
            params,
        } );
    }

    // private
    #readStat () {
        if ( this.#path && fs.existsSync( this.#path ) ) {
            const stat = fs.statSync( this.#path );

            this.#lastModifiedDate = stat.mtime;
            this.#size = stat.size;
        }
    }

    async #getBuffer () {
        if ( this.#buffer ) {
            return this.#buffer;
        }
        else if ( this.#path && fs.existsSync( this.#path + "" ) ) {
            return fs.promises.readFile( this.#path + "" );
        }
        else {
            return null;
        }
    }
}
