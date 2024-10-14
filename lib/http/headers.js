import path from "node:path";
import util from "node:util";
import Cookie from "#lib/http/cookie";

const SET_COOKIE_ATTRIBUTES = {
    "domain": [ "domain", false ],
    "path": [ "encodedPath", false ],
    "expires": [ "expires", false ],
    "max-age": [ "maxAge", false ],
    "secure": [ "secure", true ],
    "httponly": [ "httpOnly", true ],
    "partitioned": [ "partitioned", true ],
    "samesite": [ "sameSite", false ],
};

const REPLACE_VALUE = new Set( [

    //
    "age",
    "authorization",
    "content-length",
    "content-type",
    "etag",
    "expires",
    "from",
    "host",
    "if-modified-since",
    "if-unmodified-since",
    "last-modified",
    "location",
    "max-forwards",
    "proxy-authorization",
    "referer",
    "retry-after",
    "server",
    "user-agent",
] );

const ORIGINAL_NAMES = Object.fromEntries( [

    //
    "A-IM",
    "Accept",
    "Accept-Additions",
    "Accept-CH",
    "Accept-CH-Lifetime",
    "Accept-Charset",
    "Accept-Datetime",
    "Accept-Encoding",
    "Accept-Features",
    "Accept-Language",
    "Accept-Patch",
    "Accept-Post",
    "Accept-Ranges",
    "Access-Control",
    "Access-Control-Allow-Credentials",
    "Access-Control-Allow-Headers",
    "Access-Control-Allow-Methods",
    "Access-Control-Allow-Origin",
    "Access-Control-Expose-Headers",
    "Access-Control-Max-Age",
    "Access-Control-Request-Headers",
    "Access-Control-Request-Method",
    "Age",
    "Allow",
    "ALPN",
    "Alt-Svc",
    "Alt-Used",
    "Alternates",
    "AMP-Cache-Transform",
    "Apply-To-Redirect-Ref",
    "Authentication-Control",
    "Authentication-Info",
    "Authorization",
    "C-Ext",
    "C-Man",
    "C-Opt",
    "C-PEP",
    "C-PEP-Info",
    "Cache-Control",
    "Cache-Status",
    "Cal-Managed-ID",
    "CalDAV-Timezones",
    "Capsule-Protocol",
    "CDN-Cache-Control",
    "CDN-Loop",
    "Cert-Not-After",
    "Cert-Not-Before",
    "Clear-Site-Data",
    "Close",
    "Configuration-Context",
    "Connection",
    "Content-Base",
    "Content-Disposition",
    "Content-DPR",
    "Content-Encoding",
    "Content-ID",
    "Content-Language",
    "Content-Length",
    "Content-Location",
    "Content-MD5",
    "Content-Range",
    "Content-Script-Type",
    "Content-Security-Policy",
    "Content-Security-Policy-Report-Only",
    "Content-Style-Type",
    "Content-Type",
    "Content-Version",
    "Cookie",
    "Cookie2",
    "Cross-Origin-Embedder-Policy",
    "Cross-Origin-Embedder-Policy-Report-Only",
    "Cross-Origin-Opener-Policy",
    "Cross-Origin-Opener-Policy-Report-Only",
    "Cross-Origin-Resource-Policy",
    "DASL",
    "Date",
    "DAV",
    "Default-Style",
    "Delta-Base",
    "Depth",
    "Derived-From",
    "Destination",
    "Device-Memory",
    "Differential-ID",
    "Digest",
    "DNT",
    "Downlink",
    "DPR",
    "Early-Data",
    "ECT",
    "EDIINT-Features",
    "ETag",
    "Expect",
    "Expect-CT",
    "Expires",
    "Ext",
    "Feature-Policy",
    "Forwarded",
    "From",
    "Front-End-Https",
    "GetProfile",
    "Hobareg",
    "Host",
    "HTTP2-Settings",
    "If",
    "If-Match",
    "If-Modified-Since",
    "If-None-Match",
    "If-Range",
    "If-Schedule-Tag-Match",
    "If-Unmodified-Since",
    "IM",
    "Include-Referred-Token-Binding-ID",
    "Isolation",
    "Keep-Alive",
    "Label",
    "Large-Allocation",
    "Last-Event-ID",
    "Last-Modified",
    "Link",
    "Location",
    "Lock-Token",
    "Man",
    "Max-Forwards",
    "Memento-Datetime",
    "Meter",
    "Method-Check",
    "Method-Check-Expires",
    "MIME-Version",
    "Negotiate",
    "NEL",
    "OData-EntityId",
    "OData-Isolation",
    "OData-MaxVersion",
    "OData-Version",
    "Opt",
    "Optional-WWW-Authenticate",
    "Ordering-Type",
    "Origin",
    "Origin-Agent-Cluster",
    "OSCORE",
    "OSLC-Core-Version",
    "Overwrite",
    "P3P",
    "PEP",
    "Pep-Info",
    "Permissions-Policy",
    "PICS-Label",
    "Ping-From",
    "Ping-To",
    "Position",
    "Pragma",
    "Prefer",
    "Preference-Applied",
    "Priority",
    "ProfileObject",
    "Protocol",
    "Protocol-Info",
    "Protocol-Query",
    "Protocol-Request",
    "Proxy-Authenticate",
    "Proxy-Authentication-Info",
    "Proxy-Authorization",
    "Proxy-Connection",
    "Proxy-Features",
    "Proxy-Instruction",
    "Proxy-Status",
    "Public",
    "Public-Key-Pins",
    "Public-Key-Pins-Report-Only",
    "Range",
    "Redirect-Ref",
    "Referer",
    "Referer [sic]",
    "Referer-Root",
    "Referrer-Policy",
    "Refresh",
    "Repeatability-Client-ID",
    "Repeatability-First-Sent",
    "Repeatability-Request-ID",
    "Repeatability-Result",
    "Replay-Nonce",
    "Report-To",
    "Retry-After",
    "RTT",
    "Safe",
    "Save-Data",
    "Schedule-Reply",
    "Schedule-Tag",
    "Sec-CH-UA",
    "Sec-CH-UA-Arch",
    "Sec-CH-UA-Bitness",
    "Sec-CH-UA-Full-Version",
    "Sec-CH-UA-Full-Version-List",
    "Sec-CH-UA-Mobile",
    "Sec-CH-UA-Model",
    "Sec-CH-UA-Platform",
    "Sec-CH-UA-Platform-Version",
    "Sec-Fetch-Dest",
    "Sec-Fetch-Mode",
    "Sec-Fetch-Site",
    "Sec-Fetch-User",
    "Sec-GPC",
    "Sec-Token-Binding",
    "Sec-WebSocket-Accept",
    "Sec-WebSocket-Extensions",
    "Sec-WebSocket-Key",
    "Sec-WebSocket-Protocol",
    "Sec-WebSocket-Version",
    "Security-Scheme",
    "Server",
    "Server-Timing",
    "Service-Worker-Navigation-Preload",
    "Set-Cookie",
    "Set-Cookie2",
    "SetProfile",
    "SLUG",
    "SoapAction",
    "SourceMap",
    "Status",
    "Status-URI",
    "Strict-Transport-Security",
    "Sunset",
    "Surrogate-Capability",
    "Surrogate-Control",
    "TCN",
    "TE",
    "Timeout",
    "Timing-Allow-Origin",
    "Tk",
    "Topic",
    "Traceparent",
    "Tracestate",
    "Trailer",
    "Transfer-Encoding",
    "TTL",
    "Upgrade",
    "Upgrade-Insecure-Requests",
    "Urgency",
    "URI",
    "User-Agent",
    "Variant-Vary",
    "Vary",
    "Via",
    "Viewport-Width",
    "Want-Digest",
    "Warning",
    "Width",
    "WWW-Authenticate",
    "X-ATT-DeviceId",
    "X-Content-Duration",
    "X-Content-Security-Policy",
    "X-Content-Type-Options",
    "X-Correlation-ID",
    "X-Csrf-Token",
    "X-DNS-Prefetch-Control",
    "X-Forwarded-For",
    "X-Forwarded-Host",
    "X-Forwarded-Proto",
    "X-Frame-Options",
    "X-Http-Method-Override",
    "X-Powered-By",
    "X-Real-IP",
    "X-Redirect-By",
    "X-Request-ID",
    "X-Requested-With",
    "X-UA-Compatible",
    "X-UIDH",
    "X-Wap-Profile",
    "X-WebKit-CSP",
    "X-XSS-Protection",
].map( header => [ header.toLowerCase(), header ] ) );

export default class Headers {
    #headers;
    #parsed = {};
    #originalNames = {};

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

            const name = header.slice( 0, idx ).trim();
            const value = header.slice( idx + 1 ).trim();

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

        for ( const header of setCookieHeader ) {
            let cookie;

            for ( const attrubute of header.split( ";" ) ) {
                const idx = attrubute.indexOf( "=" );

                let name, value;

                if ( idx > 0 ) {
                    name = attrubute.slice( 0, idx ).trim();
                    value = attrubute.slice( idx + 1 ).trim();
                }
                else {
                    name = attrubute.slice( idx + 1 ).trim();
                }

                if ( !name && !value ) continue;

                // name / value
                if ( !cookie ) {
                    if ( value == null ) {
                        cookie = {
                            "encodedValue": name,
                        };
                    }
                    else {
                        cookie = {
                            "encodedName": name,
                            "encodedValue": value,
                        };
                    }

                    continue;
                }

                name = name.toLowerCase();

                const spec = SET_COOKIE_ATTRIBUTES[ name ];

                if ( spec ) {
                    cookie[ spec[ 0 ] ] = spec[ 1 ] || value;
                }
            }

            cookies.push( new Cookie( cookie ) );
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
            for ( const match of header.matchAll( /([*a-z]+)\s*(?:;\s*q=([\d.]+))?,?/gi ) ) {
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

            for ( const cookie of header.split( ";" ) ) {
                const idx = cookie.indexOf( "=" );

                let encodedName, encodedValue;

                if ( idx > 0 ) {
                    encodedName = cookie.slice( 0, idx ).trim();
                    encodedValue = cookie.slice( idx + 1 ).trim();
                }
                else {
                    encodedValue = cookie.slice( idx + 1 ).trim();
                }

                if ( !encodedName && !encodedValue ) continue;

                const cookie1 = new Cookie( {
                    encodedName,
                    encodedValue,
                } );

                this.#parsed[ "cookie" ][ cookie1.name ] = cookie1;
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

            this.#parsed[ "content-disposition" ].type = header.slice( 0, idx ).toLowerCase().trim();

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
                this.#parsed[ "content-type" ].type = header.slice( 0, idx ).toLowerCase().trim();

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
            this.#parsed[ "content-length" ] = Number.parseInt( this.#headers[ "content-length" ] );

            if ( Number.isNaN( this.#parsed[ "content-length" ] ) ) this.#parsed[ "content-length" ] = null;
        }

        return this.#parsed[ "content-length" ];
    }

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

            this.#parsed[ "www-authenticate" ].scheme = header.slice( 0, idx ).toLowerCase();

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

        if ( Array.isArray( value ) ) {
            for ( const data of value ) {
                this.set( name, data );
            }
        }
        else {
            const lowerName = name.toLowerCase();

            this.#originalNames[ lowerName ] = name;

            // set-cookie
            if ( lowerName === "set-cookie" ) {
                if ( typeof value !== "string" ) {
                    value = Cookie.new( value ).toSetCookieHeader();
                }

                this.#headers[ "set-cookie" ] = [ value ];
            }

            // other
            else {
                if ( value instanceof Date ) {
                    value = value.toUTCString();
                }
                else if ( typeof value !== "string" ) {
                    value = String( value );
                }

                this.#headers[ lowerName ] = value;
            }

            // drop cache
            delete this.#parsed[ lowerName ];
        }

        return this;
    }

    add ( name, value ) {
        if ( value == null ) return this;

        if ( Array.isArray( value ) ) {
            for ( const data of value ) {
                this.add( name, data );
            }
        }
        else {
            const lowerName = name.toLowerCase();

            this.#originalNames[ lowerName ] = name;

            // set-cookie
            if ( lowerName === "set-cookie" ) {
                if ( typeof value !== "string" ) {
                    value = Cookie.new( value ).toSetCookieHeader();
                }

                if ( this.#headers[ "set-cookie" ] == null ) {
                    this.#headers[ "set-cookie" ] = [ value ];
                }
                else {
                    this.#headers[ "set-cookie" ].push( value );
                }
            }
            else {
                if ( value instanceof Date ) {
                    value = value.toUTCString();
                }
                else if ( typeof value !== "string" ) {
                    value = String( value );
                }

                // replace value
                if ( REPLACE_VALUE.has( lowerName ) ) {
                    this.#headers[ lowerName ] = value;
                }

                // cookie
                else if ( lowerName === "cookie" ) {
                    if ( this.#headers.cookie == null ) {
                        this.#headers.cookie = value;
                    }
                    else {
                        this.#headers.cookie += "; " + value;
                    }
                }

                // other
                else {
                    if ( this.#headers[ lowerName ] == null ) {
                        this.#headers[ lowerName ] = value;
                    }
                    else {
                        this.#headers[ lowerName ] += ", " + value;
                    }
                }
            }

            // drop cache
            delete this.#parsed[ lowerName ];
        }

        return this;
    }

    delete ( name ) {
        name = name.toLowerCase();

        delete this.#headers[ name ];

        // drop cache
        delete this.#parsed[ name ];
    }

    toString () {
        const headers = [];

        for ( const [ name, value ] of Object.entries( this.#headers ) ) {
            if ( Array.isArray( value ) ) {
                for ( const data of value ) {
                    headers.push( `${ this.getOriginalName( name ) }: ${ data }\r\n` );
                }
            }
            else {
                headers.push( `${ this.getOriginalName( name ) }: ${ value }\r\n` );
            }
        }

        return headers.join( "" );
    }

    toJSON () {
        const headers = {};

        for ( const [ name, value ] of Object.entries( this.#headers ) ) {
            headers[ this.getOriginalName( name ) ] = value;
        }

        return headers;
    }

    [ util.inspect.custom ] ( depth, options ) {
        return this.toString();
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

    getOriginalName ( name ) {
        const lowerName = name.toLowerCase();

        return ORIGINAL_NAMES[ lowerName ] || this.#originalNames[ lowerName ] || name;
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
        const maxEnd = size
            ? size - 1
            : 0;

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
