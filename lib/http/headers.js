import path from "node:path";

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

const ORIGINAL_NAMES = {
    "a-im": "A-IM",
    "accept": "Accept",
    "accept-additions": "Accept-Additions",
    "accept-ch": "Accept-CH",
    "accept-ch-lifetime": "Accept-CH-Lifetime",
    "accept-charset": "Accept-Charset",
    "accept-datetime": "Accept-Datetime",
    "accept-encoding": "Accept-Encoding",
    "accept-features": "Accept-Features",
    "accept-language": "Accept-Language",
    "accept-patch": "Accept-Patch",
    "accept-post": "Accept-Post",
    "accept-ranges": "Accept-Ranges",
    "access-control": "Access-Control",
    "access-control-allow-credentials": "Access-Control-Allow-Credentials",
    "access-control-allow-headers": "Access-Control-Allow-Headers",
    "access-control-allow-methods": "Access-Control-Allow-Methods",
    "access-control-allow-origin": "Access-Control-Allow-Origin",
    "access-control-expose-headers": "Access-Control-Expose-Headers",
    "access-control-max-age": "Access-Control-Max-Age",
    "access-control-request-headers": "Access-Control-Request-Headers",
    "access-control-request-method": "Access-Control-Request-Method",
    "age": "Age",
    "allow": "Allow",
    "alpn": "ALPN",
    "alt-svc": "Alt-Svc",
    "alt-used": "Alt-Used",
    "alternates": "Alternates",
    "amp-cache-transform": "AMP-Cache-Transform",
    "apply-to-redirect-ref": "Apply-To-Redirect-Ref",
    "authentication-control": "Authentication-Control",
    "authentication-info": "Authentication-Info",
    "authorization": "Authorization",
    "c-ext": "C-Ext",
    "c-man": "C-Man",
    "c-opt": "C-Opt",
    "c-pep": "C-PEP",
    "c-pep-info": "C-PEP-Info",
    "cache-control": "Cache-Control",
    "cache-status": "Cache-Status",
    "cal-managed-id": "Cal-Managed-ID",
    "caldav-timezones": "CalDAV-Timezones",
    "capsule-protocol": "Capsule-Protocol",
    "cdn-cache-control": "CDN-Cache-Control",
    "cdn-loop": "CDN-Loop",
    "cert-not-after": "Cert-Not-After",
    "cert-not-before": "Cert-Not-Before",
    "clear-site-data": "Clear-Site-Data",
    "close": "Close",
    "configuration-context": "Configuration-Context",
    "connection": "Connection",
    "content-base": "Content-Base",
    "content-disposition": "Content-Disposition",
    "content-dpr": "Content-DPR",
    "content-encoding": "Content-Encoding",
    "content-id": "Content-ID",
    "content-language": "Content-Language",
    "content-length": "Content-Length",
    "content-location": "Content-Location",
    "content-md5": "Content-MD5",
    "content-range": "Content-Range",
    "content-script-type": "Content-Script-Type",
    "content-security-policy": "Content-Security-Policy",
    "content-security-policy-report-only": "Content-Security-Policy-Report-Only",
    "content-style-type": "Content-Style-Type",
    "content-type": "Content-Type",
    "content-version": "Content-Version",
    "cookie": "Cookie",
    "cookie2": "Cookie2",
    "cross-origin-embedder-policy": "Cross-Origin-Embedder-Policy",
    "cross-origin-embedder-policy-report-only": "Cross-Origin-Embedder-Policy-Report-Only",
    "cross-origin-opener-policy": "Cross-Origin-Opener-Policy",
    "cross-origin-opener-policy-report-only": "Cross-Origin-Opener-Policy-Report-Only",
    "cross-origin-resource-policy": "Cross-Origin-Resource-Policy",
    "dasl": "DASL",
    "date": "Date",
    "dav": "DAV",
    "default-style": "Default-Style",
    "delta-base": "Delta-Base",
    "depth": "Depth",
    "derived-from": "Derived-From",
    "destination": "Destination",
    "device-memory": "Device-Memory",
    "differential-id": "Differential-ID",
    "digest": "Digest",
    "dnt": "DNT",
    "downlink": "Downlink",
    "dpr": "DPR",
    "early-data": "Early-Data",
    "ect": "ECT",
    "ediint-features": "EDIINT-Features",
    "etag": "ETag",
    "expect": "Expect",
    "expect-ct": "Expect-CT",
    "expires": "Expires",
    "ext": "Ext",
    "feature-policy": "Feature-Policy",
    "forwarded": "Forwarded",
    "from": "From",
    "front-end-https": "Front-End-Https",
    "getprofile": "GetProfile",
    "hobareg": "Hobareg",
    "host": "Host",
    "http2-settings": "HTTP2-Settings",
    "if": "If",
    "if-match": "If-Match",
    "if-modified-since": "If-Modified-Since",
    "if-none-match": "If-None-Match",
    "if-range": "If-Range",
    "if-schedule-tag-match": "If-Schedule-Tag-Match",
    "if-unmodified-since": "If-Unmodified-Since",
    "im": "IM",
    "include-referred-token-binding-id": "Include-Referred-Token-Binding-ID",
    "isolation": "Isolation",
    "keep-alive": "Keep-Alive",
    "label": "Label",
    "large-allocation": "Large-Allocation",
    "last-event-id": "Last-Event-ID",
    "last-modified": "Last-Modified",
    "link": "Link",
    "location": "Location",
    "lock-token": "Lock-Token",
    "man": "Man",
    "max-forwards": "Max-Forwards",
    "memento-datetime": "Memento-Datetime",
    "meter": "Meter",
    "method-check": "Method-Check",
    "method-check-expires": "Method-Check-Expires",
    "mime-version": "MIME-Version",
    "negotiate": "Negotiate",
    "nel": "NEL",
    "odata-entityid": "OData-EntityId",
    "odata-isolation": "OData-Isolation",
    "odata-maxversion": "OData-MaxVersion",
    "odata-version": "OData-Version",
    "opt": "Opt",
    "optional-www-authenticate": "Optional-WWW-Authenticate",
    "ordering-type": "Ordering-Type",
    "origin": "Origin",
    "origin-agent-cluster": "Origin-Agent-Cluster",
    "oscore": "OSCORE",
    "oslc-core-version": "OSLC-Core-Version",
    "overwrite": "Overwrite",
    "p3p": "P3P",
    "pep": "PEP",
    "pep-info": "Pep-Info",
    "permissions-policy": "Permissions-Policy",
    "pics-label": "PICS-Label",
    "ping-from": "Ping-From",
    "ping-to": "Ping-To",
    "position": "Position",
    "pragma": "Pragma",
    "prefer": "Prefer",
    "preference-applied": "Preference-Applied",
    "priority": "Priority",
    "profileobject": "ProfileObject",
    "protocol": "Protocol",
    "protocol-info": "Protocol-Info",
    "protocol-query": "Protocol-Query",
    "protocol-request": "Protocol-Request",
    "proxy-authenticate": "Proxy-Authenticate",
    "proxy-authentication-info": "Proxy-Authentication-Info",
    "proxy-authorization": "Proxy-Authorization",
    "proxy-connection": "Proxy-Connection",
    "proxy-features": "Proxy-Features",
    "proxy-instruction": "Proxy-Instruction",
    "proxy-status": "Proxy-Status",
    "public": "Public",
    "public-key-pins": "Public-Key-Pins",
    "public-key-pins-report-only": "Public-Key-Pins-Report-Only",
    "range": "Range",
    "redirect-ref": "Redirect-Ref",
    "referer": "Referer",
    "referer [sic]": "Referer [sic]",
    "referer-root": "Referer-Root",
    "referrer-policy": "Referrer-Policy",
    "refresh": "Refresh",
    "repeatability-client-id": "Repeatability-Client-ID",
    "repeatability-first-sent": "Repeatability-First-Sent",
    "repeatability-request-id": "Repeatability-Request-ID",
    "repeatability-result": "Repeatability-Result",
    "replay-nonce": "Replay-Nonce",
    "report-to": "Report-To",
    "retry-after": "Retry-After",
    "rtt": "RTT",
    "safe": "Safe",
    "save-data": "Save-Data",
    "schedule-reply": "Schedule-Reply",
    "schedule-tag": "Schedule-Tag",
    "sec-ch-ua": "Sec-CH-UA",
    "sec-ch-ua-arch": "Sec-CH-UA-Arch",
    "sec-ch-ua-bitness": "Sec-CH-UA-Bitness",
    "sec-ch-ua-full-version": "Sec-CH-UA-Full-Version",
    "sec-ch-ua-full-version-list": "Sec-CH-UA-Full-Version-List",
    "sec-ch-ua-mobile": "Sec-CH-UA-Mobile",
    "sec-ch-ua-model": "Sec-CH-UA-Model",
    "sec-ch-ua-platform": "Sec-CH-UA-Platform",
    "sec-ch-ua-platform-version": "Sec-CH-UA-Platform-Version",
    "sec-fetch-dest": "Sec-Fetch-Dest",
    "sec-fetch-mode": "Sec-Fetch-Mode",
    "sec-fetch-site": "Sec-Fetch-Site",
    "sec-fetch-user": "Sec-Fetch-User",
    "sec-gpc": "Sec-GPC",
    "sec-token-binding": "Sec-Token-Binding",
    "sec-websocket-accept": "Sec-WebSocket-Accept",
    "sec-websocket-extensions": "Sec-WebSocket-Extensions",
    "sec-websocket-key": "Sec-WebSocket-Key",
    "sec-websocket-protocol": "Sec-WebSocket-Protocol",
    "sec-websocket-version": "Sec-WebSocket-Version",
    "security-scheme": "Security-Scheme",
    "server": "Server",
    "server-timing": "Server-Timing",
    "service-worker-navigation-preload": "Service-Worker-Navigation-Preload",
    "set-cookie": "Set-Cookie",
    "set-cookie2": "Set-Cookie2",
    "setprofile": "SetProfile",
    "slug": "SLUG",
    "soapaction": "SoapAction",
    "sourcemap": "SourceMap",
    "status": "Status",
    "status-uri": "Status-URI",
    "strict-transport-security": "Strict-Transport-Security",
    "sunset": "Sunset",
    "surrogate-capability": "Surrogate-Capability",
    "surrogate-control": "Surrogate-Control",
    "tcn": "TCN",
    "te": "TE",
    "timeout": "Timeout",
    "timing-allow-origin": "Timing-Allow-Origin",
    "tk": "Tk",
    "topic": "Topic",
    "traceparent": "Traceparent",
    "tracestate": "Tracestate",
    "trailer": "Trailer",
    "transfer-encoding": "Transfer-Encoding",
    "ttl": "TTL",
    "upgrade": "Upgrade",
    "upgrade-insecure-requests": "Upgrade-Insecure-Requests",
    "urgency": "Urgency",
    "uri": "URI",
    "user-agent": "User-Agent",
    "variant-vary": "Variant-Vary",
    "vary": "Vary",
    "via": "Via",
    "viewport-width": "Viewport-Width",
    "want-digest": "Want-Digest",
    "warning": "Warning",
    "width": "Width",
    "www-authenticate": "WWW-Authenticate",
    "x-att-deviceid": "X-ATT-DeviceId",
    "x-content-duration": "X-Content-Duration",
    "x-content-security-policy": "X-Content-Security-Policy",
    "x-content-type-options": "X-Content-Type-Options",
    "x-correlation-id": "X-Correlation-ID",
    "x-csrf-token": "X-Csrf-Token",
    "x-dns-prefetch-control": "X-DNS-Prefetch-Control",
    "x-forwarded-for": "X-Forwarded-For",
    "x-forwarded-host": "X-Forwarded-Host",
    "x-forwarded-proto": "X-Forwarded-Proto",
    "x-frame-options": "X-Frame-Options",
    "x-http-method-override": "X-Http-Method-Override",
    "x-powered-by": "X-Powered-By",
    "x-redirect-by": "X-Redirect-By",
    "x-request-id": "X-Request-ID",
    "x-requested-with": "X-Requested-With",
    "x-ua-compatible": "X-UA-Compatible",
    "x-uidh": "X-UIDH",
    "x-wap-profile": "X-Wap-Profile",
    "x-webkit-csp": "X-WebKit-CSP",
    "x-xss-protection": "X-XSS-Protection",
};

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

            const name = header.substring( 0, idx ).trim();
            const value = header.substring( idx + 1 ).trim();

            headers.add( name, value );
        }

        return headers;
    }

    // value cant't contains ";"
    // value must be quoted if contains leading/trailing spaces
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
                else if ( name === "partitioned" ) cookie.partitioned = true;
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
                if ( typeof value === "object" ) {
                    value = this.createCookie( value.name, value.value, value );
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
                if ( typeof value === "object" ) {
                    value = this.createCookie( value.name, value.value, value );
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

    createCookie ( name, value, { domain, path, expires, maxAge, secure, httpOnly, sameSite, partitioned } = {} ) {
        const tokens = [];

        // quote
        if ( value.startsWith( " " ) || value.endsWith( " " ) ) {
            value = `"${ value }"`;
        }

        tokens.push( `${ name }=${ value }` );

        if ( domain ) tokens.push( `Domain=${ domain }` );

        if ( path ) tokens.push( `Path=${ path }` );

        if ( expires ) {
            if ( !( expires instanceof Date ) ) {
                if ( typeof expires === "number" ) {
                    expires = new Date( expires );
                }
                else {
                    expires = new Date( String( expires ) );
                }
            }

            tokens.push( `Expires=${ expires.toUTCString() }` );
        }

        if ( maxAge ) tokens.push( `Max-Age=${ maxAge }` );

        if ( secure ) tokens.push( "Secure" );

        if ( httpOnly ) tokens.push( "HttpOnly" );

        if ( sameSite ) tokens.push( `SameSite=${ sameSite }` );

        if ( partitioned ) tokens.push( "Partitioned" );

        return tokens.join( "; " );
    }
}
