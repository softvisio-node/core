import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Blob from "#lib/blob";
import DataUrl from "#lib/data-url";
import { exists, sliceFileSync } from "#lib/fs";
import mime from "#lib/mime";
import stream from "#lib/stream";

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
                throw new Error( "Only data: anf file: urls are supported" );
            }
        }

        this.#path = path;
        this.setName( name );
        this.setType( type );

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
        if ( this.#lastModifiedDate == null ) this.#getStatSync();

        return this.#lastModifiedDate;
    }

    get name () {
        if ( this.#name === undefined ) {
            if ( this.#path ) {
                this.#name = path.basename( this.#path );
            }

            this.#name ||= null;
        }

        return this.#name;
    }

    get type () {
        if ( this.#type === undefined ) {
            if ( this.name ) {
                this.#type = mime.findSync( {
                    "filename": this.name,
                } )?.essence;
            }

            this.#type ||= null;
        }

        return this.#type;
    }

    get category () {
        if ( this.#category === undefined ) {
            if ( this.type ) this.#category = this.type.slice( 0, this.type.indexOf( "/" ) );

            this.#category ||= null;
        }

        return this.#category;
    }

    get size () {
        if ( this.#size === undefined ) {
            if ( Buffer.isBuffer( this.#buffer ) ) {
                this.#size = this.#buffer.length;
            }
            else if ( !this.#stat ) {
                this.#getStatSync();
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
                await this.#getStat();
            }
        }

        return this.#size;
    }

    async getLastModified () {
        if ( !this.#stat ) {
            await this.#getStat();
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
            await this.#getStat();
        }

        return this.#lastModifiedDate;
    }

    setName ( value ) {
        if ( value == null ) {
            this.#name = value;
        }
        else if ( typeof value === "string" ) {
            this.#name = value || null;
        }
        else {
            throw new Error( "Name should be a String" );
        }

        return this;
    }

    setType ( value ) {
        if ( value == null ) {
            this.#type = value;
        }
        else if ( typeof value === "string" ) {
            this.#type = value || null;
        }
        else {
            throw new Error( "Type should be a String" );
        }

        this.#category = undefined;

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

    stream ( { name, type, start, end } = {} ) {
        if ( this.#buffer ) {
            let buffer = this.#buffer;

            if ( start !== undefined || end !== undefined ) buffer = buffer.subarray( start, end );

            return stream.Readable.from( buffer, {
                "objectMode": false,
            } )
                .setName( name === undefined
                    ? this.name
                    : name )
                .setType( type === undefined
                    ? this.type
                    : type )
                .setSize( buffer.length );
        }
        else if ( this.#path && fs.existsSync( this.#path + "" ) ) {
            let size = this.size;

            if ( start === undefined && end === undefined ) {
                return fs
                    .createReadStream( this.#path + "" )
                    .setName( name === undefined
                        ? this.name
                        : name )
                    .setType( type === undefined
                        ? this.type
                        : type )
                    .setSize( size );
            }
            else {
                start ??= 0;

                if ( start < 0 ) {
                    start = size + start;
                    if ( start < 0 ) start = 0;
                }
                else if ( start > size ) {
                    start = size;
                }

                end ??= 0;

                if ( end < 0 ) {
                    end = size + end;
                    if ( end < 0 ) end = 0;
                }
                else if ( end > size ) {
                    end = size;
                }

                size = end - start;

                if ( size <= 0 ) {
                    return stream.Readable.from( "", {
                        "objectMode": false,
                    } )
                        .setName( name === undefined
                            ? this.name
                            : name )
                        .setType( type === undefined
                            ? this.type
                            : type )
                        .setSize( 0 );
                }
                else {

                    // make end inclusive
                    if ( end ) end--;

                    return fs
                        .createReadStream( this.#path + "", { start, end } )
                        .setName( name === undefined
                            ? this.name
                            : name )
                        .setType( type === undefined
                            ? this.type
                            : type )
                        .setSize( size );
                }
            }
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
    async #getStat () {
        if ( !this.#stat && this.#path ) {
            try {
                this.#stat = await fs.promises.stat( this.#path );

                this.#lastModifiedDate = this.#stat.mtime;
                this.#size = this.#stat.size;
            }
            catch ( e ) {

                // file not found
                if ( e.code === "ENOENT" ) return;

                throw e;
            }
        }
    }

    #getStatSync () {
        if ( !this.#stat && this.#path ) {
            try {
                this.#stat = fs.statSync( this.#path );

                this.#lastModifiedDate = this.#stat.mtime;
                this.#size = this.#stat.size;
            }
            catch ( e ) {

                // file not found
                if ( e.code === "ENOENT" ) return;

                throw e;
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
