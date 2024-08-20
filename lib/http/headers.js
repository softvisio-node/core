import path from "node:path";

const SINGLE = new Set( [ "age", "authorization", "content-length", "content-type", "etag", "expires", "from", "host", "if-modified-since", "if-unmodified-since", "last-modified", "location", "max-forwards", "proxy-authorization", "referer", "retry-after", "server", "or user-agent" ] );

const PARSED_HEADERS = new Set( "accept-encoding", "content-type", "content-length", "cookie", "content-disposition", "range", "set-cookie", "www-authenticate" );

export default class Headers {
    #headers;
    #parsed = {};
    #string;

    constructor ( headers ) {
        this.#headers = {};

        if ( headers ) {
            if ( Array.isArray( headers ) ) {
                for ( let n = 0; n < headers.length; n += 2 ) {
                    this.add( headers[ n ], headers[ n + 1 ] );
                }
            }
            else if ( typeof headers.entries === "function" ) {
                this.#headers = {};

                for ( const [ key, value ] of headers.entries() ) this.add( key, value );
            }
            else {
                this.#headers = {};

                for ( const [ key, value ] of Object.entries( headers ) ) this.add( key, value );
            }
        }
    }

    // static
    static parse ( buffer ) {
        const headers = new this();

        if ( Buffer.isBuffer( buffer ) ) buffer = buffer.toString( "latin1" );

        for ( const header of buffer.split( "\r\n" ) ) {
            const idx = header.indexOf( ":" );

            const name = header.substring( 0, idx ).trim();
            const value = header.substring( idx + 1 ).trim();

            headers.add( name, value );
        }

        return headers;
    }

    static parseSetCookie ( setCookieHeader ) {
        if ( !setCookieHeader ) return [];

        if ( !Array.isArray( setCookieHeader ) ) {
            setCookieHeader = [ setCookieHeader ];
        }

        const cookies = [];

        NEXT_COOKIE: for ( const header of setCookieHeader ) {
            let cookie;

            for ( const match of header.matchAll( /([^=; ]+)\s*(?:=\s*([^;]+))?;?/gi ) ) {
                let name = match[ 1 ],
                    value = match[ 2 ]?.trim();

                // name / value
                if ( !cookie ) {
                    cookie = { name, value };

                    continue;
                }

                name = name.toLowerCase();

                // attributes
                if ( name === "expires" ) {
                    value = new Date( value );

                    if ( !isFinite( value ) ) continue NEXT_COOKIE;

                    cookie.expires = value;
                }
                else if ( name === "max-age" ) {
                    value = +value;

                    if ( !isNaN( value ) ) cookie.maxAge = value;
                }
                else if ( name === "domain" ) cookie.domain = value;
                else if ( name === "path" ) cookie.path = value;
                else if ( name === "secure" ) cookie.secure = true;
                else if ( name === "httponly" ) cookie.httpOnly = true;
                else if ( name === "samesite" ) {
                    value = ( value || "" ).toLowerCase();

                    if ( value !== "strict" && value !== "lax" && value !== "none" ) continue NEXT_COOKIE;

                    cookie.sameSite = value;
                }
            }

            cookies.push( cookie );
        }

        return cookies;
    }

    // properties
    get acceptEncoding () {
        ERROR: if ( this.#parsed[ "accept-encoding" ] === undefined ) {
            this.#parsed[ "accept-encoding" ] = null;

            const header = this.#headers[ "accept-encoding" ];

            if ( !header ) break ERROR;

            const encodings = {};

            // deflate, gzip;q=1.0, *;q=0.5
            for ( const match of header.matchAll( /([a-z*]+)\s*(?:;\s*q=([\d.]+))?,?/gi ) ) {
                encodings[ match[ 1 ] ] = +( match[ 2 ] || 1 );
            }

            this.#parsed[ "accept-encoding" ] = Object.keys( encodings ).sort( ( a, b ) => encodings[ b ] - encodings[ a ] );
        }

        return this.#parsed[ "accept-encoding" ];
    }

    get cookie () {
        ERROR: if ( this.#parsed[ "cookie" ] === undefined ) {
            this.#parsed[ "cookie" ] = {};

            const header = this.#headers[ "cookie" ];

            if ( !header ) break ERROR;

            for ( const match of header.matchAll( /([^=; ]+)\s*=\s*([^;]*);?/gi ) ) {
                this.#parsed[ "cookie" ][ match[ 1 ] ] = match[ 2 ]?.trim();
            }
        }

        return this.#parsed[ "cookie" ];
    }

    get contentDisposition () {
        ERROR: if ( this.#parsed[ "content-disposition" ] === undefined ) {
            this.#parsed[ "content-disposition" ] = null;

            const header = this.#headers[ "content-disposition" ];

            if ( !header ) break ERROR;

            // parse type
            var idx = header.indexOf( ";" );
            if ( idx === -1 ) break ERROR;

            this.#parsed[ "content-disposition" ] = {};

            this.#parsed[ "content-disposition" ].type = header.substring( 0, idx ).toLowerCase().trim();

            // allowed fields: name, filename
            for ( const match of header.matchAll( /((?:file)?name)\s*=\s*(?:"([^"]+)"|([^;]+));?/g ) ) {
                const name = match[ 1 ];

                // encode latin1 -> utf8, decode `"`
                let value = Buffer.from( match[ 2 ] ?? match[ 3 ].trim(), "latin1" )
                    .toString()
                    .replaceAll( "%22", `"` );

                // truncate filename to basename
                if ( name === "filename" ) value = path.basename( value );

                this.#parsed[ "content-disposition" ][ name ] = value;
            }
        }

        return this.#parsed[ "content-disposition" ];
    }

    get contentType () {
        ERROR: if ( this.#parsed[ "content-type" ] === undefined ) {
            this.#parsed[ "content-type" ] = null;

            const header = this.#headers[ "content-type" ];

            if ( !header ) break ERROR;

            // parse type
            var idx = header.indexOf( ";" );

            this.#parsed[ "content-type" ] = {};

            if ( idx === -1 ) {
                this.#parsed[ "content-type" ].type = header.toLowerCase().trim();
            }
            else {
                this.#parsed[ "content-type" ].type = header.substring( 0, idx ).toLowerCase().trim();

                // allowed fields: charset, boundary, media-type
                for ( const match of header.matchAll( /(charset|boundary|media-type)\s*=\s*(?:"([^"]+)"|([^;]+));?/g ) ) {
                    const name = match[ 1 ];

                    const value = match[ 2 ] ?? match[ 3 ].trim();

                    this.#parsed[ "content-type" ][ name ] = value;
                }
            }
        }

        return this.#parsed[ "content-type" ];
    }

    get contentLength () {
        if ( this.#parsed[ "content-length" ] === undefined ) {
            this.#parsed[ "content-length" ] = parseInt( this.#headers[ "content-length" ] );

            if ( isNaN( this.#parsed[ "content-length" ] ) ) this.#parsed[ "content-length" ] = null;
        }

        return this.#parsed[ "content-length" ];
    }

    // value cant't contains ";"
    // value must be quoted if contains leading/trailing spaces
    get setCookie () {
        if ( this.#parsed[ "set-cookie" ] === undefined ) {
            this.#parsed[ "set-cookie" ] = this.constructor.parseSetCookie( this.#headers[ "set-cookie" ] );
        }

        return this.#parsed[ "set-cookie" ];
    }

    get range () {
        ERROR: if ( this.#parsed[ "range" ] === undefined ) {
            this.#parsed[ "range" ] = null;

            const header = this.#headers[ "range" ];

            if ( !header ) break ERROR;

            const match = header.match( /^\s*(bytes)=(.+)/ );

            if ( !match ) break ERROR;

            const unit = match[ 1 ],
                ranges = [];

            for ( const rangeString of match[ 2 ].split( "," ) ) {
                const rangeMatch = rangeString.match( /^\s*(?:(\d+)-(\d+)?|(-\d+))\s*$/ );

                if ( !rangeMatch ) break ERROR;

                let start, end;

                if ( rangeMatch[ 1 ] ) {
                    start = +rangeMatch[ 1 ];

                    if ( rangeMatch[ 2 ] ) {
                        end = +rangeMatch[ 2 ];

                        if ( start > end ) break ERROR;
                    }
                }
                else {
                    start = +rangeMatch[ 3 ];
                }

                ranges.push( {
                    start,
                    end,
                } );
            }

            if ( !ranges.length ) break ERROR;

            this.#parsed[ "range" ] = {
                unit,
                "isMultiple": ranges.length > 1,
                ranges,
            };
        }

        return this.#parsed[ "range" ];
    }

    get wwwAuthenticate () {
        ERROR: if ( this.#parsed[ "www-authenticate" ] === undefined ) {
            this.#parsed[ "www-authenticate" ] = null;

            const header = this.#headers[ "www-authenticate" ];

            if ( !header ) break ERROR;

            // parse scheme
            var idx = header.indexOf( " " );
            if ( idx === -1 ) break ERROR;

            this.#parsed[ "www-authenticate" ] = {};

            this.#parsed[ "www-authenticate" ].scheme = header.substring( 0, idx ).toLowerCase();

            for ( const match of header.matchAll( /([a-z-]+)\s*=\s*(?:"([^"]+)"|([^,]+)),?/gi ) ) {
                this.#parsed[ "www-authenticate" ][ match[ 1 ].toLowerCase() ] = match[ 2 ] ?? match[ 3 ].trim();
            }
        }

        return this.#parsed[ "www-authenticate" ];
    }

    // public
    has ( name ) {
        return name.toLowerCase() in this.#headers;
    }

    get ( name ) {
        return this.#headers[ name.toLowerCase() ];
    }

    set ( name, value ) {
        if ( value == null ) return this;

        if ( typeof value !== "string" ) value = String( value );

        name = name.toLowerCase();

        // set-cookie
        if ( name === "set-cookie" ) {
            this.#headers[ "set-cookie" ] = [ value ];
        }

        // other
        else {
            this.#headers[ name ] = value;
        }

        // drop cache
        this.#string = null;
        if ( PARSED_HEADERS.has( name ) ) this.#parsed[ name ] = undefined;

        return this;
    }

    add ( name, value ) {
        if ( value == null ) return this;

        if ( typeof value !== "string" ) value = String( value );

        name = name.toLowerCase();

        // single value
        if ( SINGLE.has( name ) ) {
            this.#headers[ name ] = value;
        }

        // cookie
        else if ( name === "cookie" ) {
            if ( this.#headers.cookie == null ) {
                this.#headers.cookie = value;
            }
            else {
                this.#headers.cookie += "; " + value;
            }
        }

        // set-cookie
        else if ( name === "set-cookie" ) {
            if ( this.#headers[ "set-cookie" ] == null ) {
                this.#headers[ "set-cookie" ] = [ value ];
            }
            else {
                this.#headers[ "set-cookie" ].push( value );
            }
        }

        // other
        else {
            if ( this.#headers[ name ] == null ) {
                this.#headers[ name ] = value;
            }
            else {
                this.#headers[ name ] += ", " + value;
            }
        }

        // drop cache
        this.#string = null;
        if ( PARSED_HEADERS.has( name ) ) this.#parsed[ name ] = undefined;

        return this;
    }

    delete ( name ) {
        name = name.toLowerCase();

        delete this.#headers[ name ];

        // drop cache
        this.#string = null;
        if ( PARSED_HEADERS.has( name ) ) this.#parsed[ name ] = undefined;
    }

    toString () {
        if ( this.#string == null ) {
            const headers = [];

            for ( const [ name, value ] of Object.entries( this.#headers ) ) {
                if ( Array.isArray( value ) ) {
                    for ( const data of value ) {
                        headers.push( `${ name }: ${ data }` );
                    }
                }
                else {
                    headers.push( `${ name }: ${ value }` );
                }
            }

            if ( headers.length ) {
                this.#string = headers.join( "\r\n" ) + "\r\n";
            }
            else {
                this.#string = "";
            }
        }

        return this.#string;
    }

    toJSON () {
        return this.#headers;
    }

    keys () {
        return Object.keys( this.#headers ).values();
    }

    entries () {
        return Object.entries( this.#headers ).values();
    }

    forEach ( callback, thisArg ) {
        for ( const name of this.keys() ) {
            Reflect.apply( callback, thisArg, [ this.#headers[ name ], name, this ] );
        }
    }

    [ Symbol.iterator ] () {
        return this.entries();
    }

    setContentDisposition ( { name, filename } = {} ) {
        var value = [];

        if ( name ) {
            value.push( "form-data", `name="${ name.replaceAll( `"`, `%22` ) }"` );
        }
        else {
            value.push( "attachment" );
        }

        if ( filename ) {
            value.push( `filename="${ filename.replaceAll( `"`, `%22` ) }"` );
        }

        this.set( "content-disposition", value.join( "; " ) );
    }

    createContentRange ( { start, end }, size, { unit = "bytes" } = {} ) {
        const maxEnd = size ? size - 1 : 0;

        if ( start < 0 ) start = size + start;

        if ( start < 0 || start > maxEnd ) return;

        end ??= maxEnd;

        if ( start > end || end > maxEnd ) return;

        return {
            start,
            "end": end,
            "size": end - start + 1,
            "contentRange": `bytes ${ start }-${ end }/${ size }`,
        };
    }
}
