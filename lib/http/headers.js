import http from "node:http";
import path from "node:path";

const SINGLE = new Set( ["age", "authorization", "content-length", "content-type", "etag", "expires", "from", "host", "if-modified-since", "if-unmodified-since", "last-modified", "location", "max-forwards", "proxy-authorization", "referer", "retry-after", "server", "or user-agent"] );

const PARSED_HEADERS = new Set( "accept-encoding", "content-type", "content-length", "cookie", "content-disposition", "range", "set-cookie", "www-authenticate" );

const NORMALIZED_HEADERS = {};

export default class Headers {
    #headers;
    #parsed = {};

    constructor ( headers ) {
        if ( !headers ) {
            this.#headers = {};
        }
        else if ( headers instanceof http.IncomingMessage ) {
            this.#headers = headers.headers;
        }
        else {
            this.#headers = {};

            for ( const [key, val] of Object.entries( headers ) ) this.append( key, val );
        }
    }

    // static
    static parse ( buffer, options ) {
        const headers = new this();

        if ( Buffer.isBuffer( buffer ) ) buffer = buffer.toString( "latin1" );

        for ( const header of buffer.split( "\r\n" ) ) {
            const idx = header.indexOf( ":" );

            const name = header.substring( 0, idx ).trim();
            const value = header.substring( idx + 1 ).trim();

            headers.append( name, value, options );
        }

        return headers;
    }

    static parseSetCookie ( setCookieHeader ) {
        if ( !setCookieHeader ) return [];

        const cookies = [];

        NEXT_COOKIE: for ( const header of setCookieHeader ) {
            let cookie;

            for ( const match of header.matchAll( /([^=; ]+)\s*(?:=\s*([^;]+))?;?/gi ) ) {
                let name = match[1],
                    value = match[2]?.trim();

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
        ERROR: if ( this.#parsed["accept-encoding"] === undefined ) {
            this.#parsed["accept-encoding"] = null;

            const header = this.#headers["accept-encoding"];

            if ( !header ) break ERROR;

            const encodings = {};

            // deflate, gzip;q=1.0, *;q=0.5
            for ( const match of header.matchAll( /([a-z*]+)\s*(?:;\s*q=([\d.]+))?,?/gi ) ) {
                encodings[match[1]] = +( match[2] || 1 );
            }

            this.#parsed["accept-encoding"] = Object.keys( encodings ).sort( ( a, b ) => encodings[b] - encodings[a] );
        }

        return this.#parsed["accept-encoding"];
    }

    get cookie () {
        ERROR: if ( this.#parsed["cookie"] === undefined ) {
            this.#parsed["cookie"] = {};

            const header = this.#headers["cookie"];

            if ( !header ) break ERROR;

            for ( const match of header.matchAll( /([^=; ]+)\s*=\s*([^;]*);?/gi ) ) {
                this.#parsed["cookie"][match[1]] = match[2]?.trim();
            }
        }

        return this.#parsed["cookie"];
    }

    get contentDisposition () {
        ERROR: if ( this.#parsed["content-disposition"] === undefined ) {
            this.#parsed["content-disposition"] = null;

            const header = this.#headers["content-disposition"];

            if ( !header ) break ERROR;

            // parse type
            var idx = header.indexOf( ";" );
            if ( idx === -1 ) break ERROR;

            this.#parsed["content-disposition"] = {};

            this.#parsed["content-disposition"].type = header.substring( 0, idx ).toLowerCase().trim();

            // allowed fields: name, filename
            for ( const match of header.matchAll( /((?:file)?name)\s*=\s*(?:"([^"]+)"|([^;]+));?/g ) ) {
                const name = match[1];

                // encode latin1 -> utf8, decode `"`
                let value = Buffer.from( match[2] ?? match[3].trim(), "latin1" )
                    .toString()
                    .replaceAll( "%22", `"` );

                // truncate filename to basename
                if ( name === "filename" ) value = path.basename( value );

                this.#parsed["content-disposition"][name] = value;
            }
        }

        return this.#parsed["content-disposition"];
    }

    get contentType () {
        ERROR: if ( this.#parsed["content-type"] === undefined ) {
            this.#parsed["content-type"] = null;

            const header = this.#headers["content-type"];

            if ( !header ) break ERROR;

            // parse type
            var idx = header.indexOf( ";" );

            this.#parsed["content-type"] = {};

            if ( idx === -1 ) {
                this.#parsed["content-type"].type = header.toLowerCase().trim();
            }
            else {
                this.#parsed["content-type"].type = header.substring( 0, idx ).toLowerCase().trim();

                // allowed fields: charset, boundary, media-type
                for ( const match of header.matchAll( /(charset|boundary|media-type)\s*=\s*(?:"([^"]+)"|([^;]+));?/g ) ) {
                    const name = match[1];

                    const value = match[2] ?? match[3].trim();

                    this.#parsed["content-type"][name] = value;
                }
            }
        }

        return this.#parsed["content-type"];
    }

    get contentLength () {
        if ( this.#parsed["content-length"] == null ) {
            this.#parsed["content-length"] = parseInt( this.#headers["content-length"] );

            if ( isNaN( this.#parsed["content-length"] ) ) this.#parsed["content-length"] = 0;
        }

        return this.#parsed["content-length"];
    }

    // value cant't contains ";"
    // value must be quoted if contains leading/trailing spaces
    get setCookie () {
        if ( this.#parsed["set-cookie"] === undefined ) {
            this.#parsed["set-cookie"] = this.constructor.parseSetCookie( this.#headers["set-cookie"] );
        }

        return this.#parsed["set-cookie"];
    }

    // XXX multiple ranges
    get range () {
        ERROR: if ( this.#parsed["range"] === undefined ) {
            this.#parsed["range"] = null;

            const header = this.#headers["range"];

            if ( !header ) break ERROR;

            const ranges = [];

            const match = header.match( /^\s*(bytes)=(\d+)?-(\d+)?/ );

            if ( !match ) break ERROR;

            const start = match[2] ? +match[2] : null,
                end = match[3] ? +match[3] : null;

            if ( start == null && end == null ) break ERROR;

            // end < start
            if ( start != null && end != null && end < start ) break ERROR;

            ranges.push( {
                start,
                end,
            } );

            this.#parsed["range"] = {
                "unit": match[1],
                "isMultiple": ranges.length > 1,
                ranges,
            };
        }

        return this.#parsed["range"];
    }

    get wwwAuthenticate () {
        ERROR: if ( this.#parsed["www-authenticate"] === undefined ) {
            this.#parsed["www-authenticate"] = null;

            const header = this.#headers["www-authenticate"];

            if ( !header ) break ERROR;

            // parse scheme
            var idx = header.indexOf( " " );
            if ( idx === -1 ) break ERROR;

            this.#parsed["www-authenticate"] = {};

            this.#parsed["www-authenticate"].scheme = header.substring( 0, idx ).toLowerCase();

            for ( const match of header.matchAll( /([a-z-]+)\s*=\s*(?:"([^"]+)"|([^,]+)),?/gi ) ) {
                this.#parsed["www-authenticate"][match[1].toLowerCase()] = match[2] ?? match[3].trim();
            }
        }

        return this.#parsed["www-authenticate"];
    }

    // public
    append ( name, value, { validate = true, ignoreInvalid = false } = {} ) {
        if ( validate ) {
            name = name.toLowerCase();

            try {
                http.validateHeaderName( name );
            }
            catch ( e ) {
                if ( ignoreInvalid ) return this;
                else throw e;
            }
        }

        if ( validate ) {
            value = String( value );

            try {
                http.validateHeaderValue( name, value );
            }
            catch ( e ) {
                if ( ignoreInvalid ) return this;
                else throw e;
            }
        }

        // single value
        if ( SINGLE.has( name ) ) {
            this.#headers[name] = value;
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
            if ( this.#headers["set-cookie"] == null ) {
                this.#headers["set-cookie"] = [value];
            }
            else {
                this.#headers["set-cookie"].push( value );
            }
        }

        // other
        else {
            if ( this.#headers[name] == null ) {
                this.#headers[name] = value;
            }
            else {
                this.#headers[name] += ", " + value;
            }
        }

        if ( PARSED_HEADERS.has( name ) ) this.#parsed[name] = undefined;

        return this;
    }

    delete ( name ) {
        delete this.#headers[name];
    }

    *entries () {
        for ( const entry of Object.entries( this.#headers ) ) {
            yield entry;
        }
    }

    forEach ( callback, thisArg ) {
        for ( const name of this.keys() ) {
            Reflect.apply( callback, thisArg, [this.#headers[name], name, this] );
        }
    }

    get ( name ) {
        return this.#headers[name];
    }

    has ( name ) {
        return name in this.#headers;
    }

    *keys () {
        for ( const name of Object.keys( this.#headers ) ) {
            yield name;
        }
    }

    set ( name, value, { validate = true, ignoreInvalid = false } = {} ) {
        if ( validate ) {
            try {
                http.validateHeaderName( name );
            }
            catch ( e ) {
                if ( ignoreInvalid ) return this;
                else throw e;
            }
        }

        if ( validate ) {
            value = String( value );

            try {
                http.validateHeaderValue( name, value );
            }
            catch ( e ) {
                if ( ignoreInvalid ) return this;
                else throw e;
            }
        }

        // set-cookie
        if ( name === "set-cookie" ) {
            this.#headers["set-cookie"] = [value];
        }

        // other
        else {
            this.#headers[name] = value;
        }

        if ( PARSED_HEADERS.has( name ) ) this.#parsed[name] = undefined;

        return this;
    }

    normalizeHeaderName ( header ) {
        var normal = NORMALIZED_HEADERS[header];

        if ( normal == null ) {
            normal = header.toLowerCase();

            normal = normal.charAt( 0 ).toUpperCase() + normal.slice( 1 );

            normal = NORMALIZED_HEADERS[header] = normal.replaceAll( /-([a-z])/g, ( header, letter ) => "-" + letter.toUpperCase() );
        }

        return normal;
    }

    getContentRange ( unit, range, size ) {
        if ( !range || !size || !unit || unit !== "bytes" ) return;

        var { start, end } = range,
            sliceEnd;

        if ( start == null ) {
            if ( end == null ) {
                start = 0;
                sliceEnd = size;
            }
            else {
                start = size - end;
                sliceEnd = size;
            }
        }
        else {
            if ( end == null ) {
                sliceEnd = size;
            }
            else {
                sliceEnd = end + 1;
            }
        }

        // range is invalid
        if ( start < 0 || start >= sliceEnd || sliceEnd < 1 || sliceEnd > size ) return;

        end = sliceEnd - 1;

        return { start, "end": sliceEnd, "size": sliceEnd - start, "contentRange": `bytes ${start}-${end}/${size}` };
    }

    toJSON () {
        return this.#headers;
    }

    toString () {
        return JSON.stringify( this.#headers, null, 4 );
    }

    *values () {
        for ( const value of Object.values( this.#headers ) ) {
            yield value;
        }
    }

    [Symbol.iterator] () {
        return this.entries();
    }
}
