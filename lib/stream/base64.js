import stream from "#lib/stream";

const DEFAULT_LINE_LENGTH = 64;

export class Encode extends stream.Transform {
    #base64url;
    #lineLength;
    #eol;
    #wrapRegExp;
    #buffer;
    #line = "";

    constructor ( { base64url, wrap, lineLength, eol } = {} ) {
        super();

        this.#base64url = Boolean( base64url );

        this.#lineLength = wrap
            ? lineLength || DEFAULT_LINE_LENGTH
            : null;

        this.#eol = eol || "\n";

        if ( this.#lineLength ) {
            this.#wrapRegExp = new RegExp( "(.{1," + this.#lineLength + "})", "g" );
        }
    }

    // protected
    _transform ( chunk, encoding, callback ) {
        if ( !Buffer.isBuffer( chunk ) ) {
            try {
                chunk = Buffer.from( chunk, encoding );
            }
            catch ( e ) {
                return callback( e );
            }
        }

        if ( this.#buffer?.length ) {
            chunk = Buffer.concat( [ this.#buffer, chunk ] );

            this.#buffer = null;
        }

        const remaining = chunk.length % 3;

        if ( remaining ) {
            this.#buffer = chunk.subarray( chunk.length - remaining );

            chunk = chunk.subarray( 0, chunk.length - remaining );
        }

        try {
            const data = this.#wrap( this.#encode( chunk ) );

            if ( data ) this.push( data, "ascii" );

            callback();
        }
        catch ( e ) {
            callback( e );
        }
    }

    _flush ( callback ) {
        var data;

        if ( this.#buffer?.length ) {
            try {
                data = this.#wrap( this.#encode( this.#buffer ), true );
            }
            catch ( e ) {
                return callback( e );
            }
        }
        else {
            data = this.#wrap( null, true );
        }

        if ( data ) this.push( data, "ascii" );

        callback();
    }

    // private
    #encode ( buffer ) {
        return buffer.toString( this.#base64url
            ? "base64url"
            : "base64" );
    }

    #wrap ( data, flush ) {
        if ( !this.#lineLength ) {
            return data;
        }

        data = this.#line + ( data || "" );
        this.#line = "";

        if ( !data ) {
            return;
        }
        else if ( data.length < this.#lineLength ) {
            if ( flush ) {
                return data + this.#eol;
            }
            else {
                this.#line = data;
            }
        }
        else if ( data.length === this.#lineLength ) {
            return data + this.#eol;
        }
        else {
            const lines = [];

            for ( const match of data.matchAll( this.#wrapRegExp ) ) {
                const line = match[ 1 ];

                // store last incomplete line
                if ( !flush && line.length !== this.#lineLength ) {
                    this.#line = line;
                }
                else {
                    lines.push( line );
                }
            }

            return lines.join( this.#eol ) + this.#eol;
        }
    }
}

export class Decode extends stream.Transform {
    #base64url;
    #buffer = "";

    constructor ( { base64url } = {} ) {
        super();

        this.#base64url = Boolean( base64url );
    }

    // protected
    _transform ( chunk, encoding, callback ) {
        if ( Buffer.isBuffer( chunk ) ) {
            try {
                chunk = chunk.toString( "ascii" );
            }
            catch ( e ) {
                return callback( e );
            }
        }

        chunk = ( this.#buffer + chunk ).replaceAll( /(\r\n|\n|\r)/gm, "" );

        // min. 4 chars are required
        if ( chunk.length < 4 ) {
            this.#buffer = chunk;

            return callback();
        }

        // 4 characters represent 3 bytes, so we can only decode in groups of 4 chars
        const remaining = chunk.length % 4;

        if ( remaining ) {
            this.#buffer = chunk.slice( chunk.length - remaining );

            chunk = chunk.slice( 0, chunk.length - remaining );
        }
        else {
            this.#buffer = "";
        }

        try {
            callback( null, this.#decode( chunk ) );
        }
        catch ( e ) {
            callback( e );
        }
    }

    _flush ( callback ) {
        if ( this.#buffer ) {
            try {
                callback( null, this.#decode( this.#buffer ) );

                this.#buffer = "";
            }
            catch ( e ) {
                callback( e );
            }
        }
        else {
            callback();
        }
    }

    // private
    #decode ( string ) {
        const buffer = Buffer.from( string, this.#base64url
            ? "base64url"
            : "base64" );

        if ( !buffer.length ) {
            throw new Error( "Base64 data is not valid" );
        }

        return buffer;
    }
}
