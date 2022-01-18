import http from "node:http";

const SINGLE = new Set( ["age", "authorization", "content-length", "content-type", "etag", "expires", "from", "host", "if-modified-since", "if-unmodified-since", "last-modified", "location", "max-forwards", "proxy-authorization", "referer", "retry-after", "server", "or user-agent"] );

const PARSED_HEADERS = new Set( "set-cookie", "www-authenticate", "content-disposition" );

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

    // properties
    // value cant't contains ";"
    // value must be quoted if contains leading/trailing spaces
    get setCookie () {
        if ( this.#parsed["set-cookie"] == null ) {
            const cookies = [];

            NEXT_COOKIE: for ( const header of this.#headers["set-cookie"] || [] ) {
                const tokens = header.split( ";" ).map( token => token.trim() );

                if ( !tokens[0] ) continue;

                const cookie = {};

                let [name, value] = tokens.shift().split( /\s*=\s*(.+)/ );

                cookie.name = name;
                cookie.value = value;

                for ( const token of tokens ) {
                    [name, value] = token.split( /\s*=\s*(.+)/ );

                    name = name.toLowerCase();

                    if ( name === "expires" ) {
                        value = new Date( value );

                        if ( !isFinite( value ) ) continue NEXT_COOKIE;

                        cookie.expires = value;
                    }
                    else if ( name === "max-age" ) cookie.maxAge = value;
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

            this.#parsed["set-cookie"] = cookies;
        }

        return this.#parsed["set-cookie"];
    }

    get wwwAuthenticate () {
        ERROR: if ( this.#parsed["www-authenticate"] === undefined ) {
            this.#parsed["www-authenticate"] = null;

            const header = ( this.#headers["www-authenticate"] || "" ).trim();

            if ( !header ) break ERROR;

            // parse scheme
            var idx = header.indexOf( " " );
            if ( idx === -1 ) break ERROR;

            this.#parsed["www-authenticate"] = {};

            this.#parsed["www-authenticate"].scheme = header.substring( 0, idx ).toLowerCase();

            for ( const match of header.matchAll( /([a-z-]+)=(?:"([^"]+)"|([^,]+))(?:,\s*)?/gi ) ) {
                this.#parsed["www-authenticate"][match[1].toLowerCase()] = match[2] ?? match[3];
            }
        }

        return this.#parsed["www-authenticate"];
    }

    // XXX
    get contentDisposition () {
        if ( this.#parsed["content-disposition"] == null ) {
            const header = this.#headers["content-disposition"];

            if ( !header ) return null;

            this.#parsed["content-disposition"] = {};
        }

        return this.#parsed["content-disposition"];
    }

    // public
    append ( name, value, { validate = true } = {} ) {
        if ( validate ) {
            name = name.toLowerCase();
            http.validateHeaderName( name );
        }

        if ( validate ) {
            value = String( value );
            http.validateHeaderValue( name, value );
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
    }

    delete ( name ) {
        delete this.#headers[name.toLowerCase()];
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
        return this.#headers[name.toLowerCase()];
    }

    has ( name ) {
        return name.toLowerCase() in this.#headers;
    }

    *keys () {
        for ( const name of Object.keys( this.#headers ) ) {
            yield name;
        }
    }

    set ( name, value, { validate = true } = {} ) {
        if ( validate ) {
            name = name.toLowerCase();
            http.validateHeaderName( name );
        }

        if ( validate ) {
            value = String( value );
            http.validateHeaderValue( name, value );
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
    }

    toJSON () {
        return JSON.stringify( this.#headers );
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
