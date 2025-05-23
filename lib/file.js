import fs from "node:fs";
import path from "node:path";
import stream from "node:stream";
import { fileURLToPath } from "node:url";
import Blob from "#lib/blob";
import DataUrl from "#lib/data-url";
import { exists, sliceFileSync } from "#lib/fs";
import mime from "#lib/mime";

const DEFAULT_MIME_TYPE = "application/octet-stream";

export default class File extends Blob {
    #path;
    #name;
    #type;
    #category;
    #buffer;
    #stat;
    #size;
    #lastModifiedDate;
    #typeChecked;

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
                const dataUrl = new DataUrl( path );

                type = dataUrl.type;
                buffer = dataUrl.data;
                name = dataUrl.searchParams.get( "name" );
                path = dataUrl.searchParams.get( "path" );
            }
            else if ( path.protocol === "file:" ) {
                path = fileURLToPath( path );
            }
            else {
                throw new Error( `Only data: anf file: urls are supported` );
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
        if ( this.lastModifiedDate ) {
            return this.lastModifiedDate.getTime();
        }
        else {
            return null;
        }
    }

    get lastModifiedDate () {
        if ( this.#lastModifiedDate == null ) this.#readStatSync();

        return this.#lastModifiedDate;
    }

    get name () {
        if ( this.#name == null && this.#path != null ) this.#name = path.basename( this.#path );

        return this.#name;
    }

    // XXX - remove???
    set name ( value ) {
        this.#name = value;

        this.#typeChecked = false;
        this.type = null;
    }

    // XXX undefined
    get type () {
        if ( !this.#type && !this.#typeChecked ) {
            this.#typeChecked = true;

            this.#type =
                mime.findSync( {
                    "filename": this.name,
                } )?.essence || null;
        }

        return this.#type;
    }

    // XXX - remove???
    set type ( value ) {
        this.#type = value;
        this.#category = null;
    }

    get category () {
        if ( this.#category == null ) {
            if ( this.type ) this.#category = this.type.slice( 0, this.type.indexOf( "/" ) );
        }

        return this.#category;
    }

    get size () {
        if ( this.#size === undefined ) {
            if ( Buffer.isBuffer( this.#buffer ) ) {
                this.#size = this.#buffer.length;
            }
            else if ( !this.#stat ) {
                this.#readStatSync();
            }
        }

        return this.#size;
    }

    get path () {
        return this.#path;
    }

    // public
    async getSize () {
        if ( this.#size === undefined ) {
            if ( Buffer.isBuffer( this.#buffer ) ) {
                this.#size = this.#buffer.length;
            }
            else if ( !this.#stat ) {
                await this.#readStat();
            }
        }

        return this.#size;
    }

    async getLastModified () {
        if ( !this.#stat ) {
            await this.#readStat();
        }

        if ( this.lastModifiedDate ) {
            return this.lastModifiedDate.getTime();
        }
        else {
            return null;
        }
    }

    async getLastModifiedDate () {
        if ( this.#lastModifiedDate == null && !this.#stat ) {
            await this.#readStat();
        }

        return this.#lastModifiedDate;
    }

    // XXX
    setName ( value ) {
        this.name = value;

        return this;
    }

    // XXX
    setType ( value ) {
        this.type = value;

        return this;
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

    slice ( start, end, type ) {
        var buffer;

        if ( this.#buffer ) {
            buffer = this.#buffer.subarray( start, end );
        }
        else if ( this.#path && fs.existsSync( this.#path + "" ) ) {
            buffer = sliceFileSync( this.#path + "", start, end );
        }
        else {
            buffer = Buffer.from( "" );
        }

        return new Blob( [ buffer ], {
            "type": type,
        } );
    }

    async dataUrl ( { encoding = "base64", withName } = {} ) {
        const url = new DataUrl();

        if ( withName && this.name ) url.searchParams.set( "name", this.name );

        url.type = this.tyle;

        url.encoding = "base64";

        url.data = await this.#getBuffer();

        return url.href;
    }

    [ Symbol.for( "nodejs.util.inspect.custom" ) ] ( depth, options, inspect ) {
        const spec = {};

        if ( this.path ) spec.path = this.path;
        if ( this.name ) spec.name = this.name;
        if ( this.type ) spec.type = this.type;

        return "File: " + inspect( spec );
    }

    // private
    async #readStat () {
        if ( !this.#stat ) {
            if ( this.#path && ( await exists( this.#path ) ) ) {
                this.#stat = await fs.promises.stat( this.#path );

                this.#lastModifiedDate = this.#stat.mtime;
                this.#size = this.#stat.size;
            }
        }
    }

    #readStatSync () {
        if ( !this.#stat ) {
            if ( this.#path && fs.existsSync( this.#path ) ) {
                this.#stat = fs.statSync( this.#path );

                this.#lastModifiedDate = this.#stat.mtime;
                this.#size = this.#stat.size;
            }
        }
    }

    async #getBuffer () {
        if ( this.#buffer ) {
            return this.#buffer;
        }
        else if ( this.#path && ( await exists( this.#path + "" ) ) ) {
            return fs.promises.readFile( this.#path + "" );
        }
        else {
            return null;
        }
    }
}
