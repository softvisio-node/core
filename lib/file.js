import fs from "node:fs";
import path from "node:path";
import mime from "#lib/mime";
import stream from "node:stream";
import { fileURLToPath } from "node:url";
import { parseDataUrl, createDataUrl } from "#lib/data-url";
import Blob from "#lib/blob";

const DEFAULT_MIME_TYPE = "application/octet-stream";

export default class File extends Blob {
    #path;
    #name;
    #type;
    #category;
    #size;
    #buffer;
    #lastModifiedDate;
    #typeChecked;

    #stream;

    constructor ( path ) {
        super();

        var name, type, buffer;

        if ( typeof path === "object" ) {
            if ( !( path instanceof URL ) ) {
                ( { path, name, type, buffer } = path );
            }
        }

        if ( typeof path === "string" ) {
            if ( path.startsWith( "file:" ) ) {
                path = fileURLToPath( path );
            }
            else if ( path.startsWith( "data:" ) ) {
                path = new URL( path );
            }
        }

        if ( path instanceof URL ) {
            if ( path.protocol === "data:" ) {
                const dataUrl = parseDataUrl( path );

                type = dataUrl.type;
                buffer = dataUrl.data;
                name = dataUrl.params?.get( "name" );
                path = dataUrl.params?.get( "path" );
            }
            else if ( path.protocol === "file:" ) {
                path = fileURLToPath( path );
            }
            else {
                throw Error( `Only data: anf file: urls are supported` );
            }
        }

        this.#path = path;
        this.#name = name;
        this.#type = type;

        if ( buffer != null ) {
            if ( Buffer.isBuffer( buffer ) ) {
                this.#buffer = buffer;
            }
            else {
                this.#buffer = Buffer.from( buffer );
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
        this.type = null;
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
        this.#category = null;
    }

    get category () {
        if ( this.#category == null ) {
            if ( this.type ) this.#category = this.type.substring( 0, this.type.indexOf( "/" ) );
        }

        return this.#category;
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
        var params;

        if ( this.#path || this.name ) {
            params = new URLSearchParams();

            if ( this.#path ) params.set( "path", this.#path );
            if ( this.name ) params.set( "name", this.name );
        }

        return createDataUrl( {
            "type": this.type,
            "data": this.#buffer,
            "encoding": "base64",
            params,
        } );
    }

    async arrayBuffer () {
        const buffer = await this.#getBuffer();

        return buffer.buffer;
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

    async dataUrl ( { encoding = "base64", withName } = {} ) {
        var params;

        if ( withName && this.name ) params = new URLSearchParams( { "name": this.name } );

        return createDataUrl( {
            "type": this.type,
            "data": await this.#getBuffer(),
            encoding,
            params,
        } );
    }

    [Symbol.for( "nodejs.util.inspect.custom" )] ( depth, inspectOptions, inspect ) {
        return (
            "File " +
            inspect( {
                "path": this.path,
                "name": this.name,
                "type": this.type,
            } )
        );
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
