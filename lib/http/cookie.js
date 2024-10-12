import util from "node:util";

const SAME_SITE = {
    "none": "None",
    "strict": "Strict",
    "lax": "Lax",
};

export default class Cookie {
    #name;
    #value;
    #encodedName;
    #encodedValue;
    #domain;
    #path;
    #maxAge;
    #expires;
    #secure;
    #httpOnly;
    #partitioned;
    #sameSite;

    #isSession = true;
    #isExpired = false;
    #expirationTimestamp;
    #cookieHeader;
    #setCookieHeader;

    constructor ( { name, value, encodedName, encodedValue, domain, path, maxAge, expires, secure, httpOnly, partitioned, sameSite } = {} ) {
        this.#name = name;
        this.#value = value;
        this.#encodedName = encodedName;
        this.#encodedValue = encodedValue;
        this.#domain = domain;
        this.#path = path || "/";
        this.#secure = !!secure;
        this.#httpOnly = !!httpOnly;
        this.#partitioned = !!partitioned;
        this.#sameSite = SAME_SITE[ sameSite?.toLowerCase() ]
            ? sameSite
            : null;

        // max age
        if ( maxAge != null ) {
            maxAge = +maxAge;

            if ( Number.isInteger( maxAge ) ) {
                this.#isSession = false;
                this.#maxAge = maxAge;
                this.#expirationTimestamp = Date.now() + maxAge * 1000;
            }
        }

        if ( expires != null && this.#maxAge != null ) {
            expires = new Date( expires );

            if ( Number.isFinite( expires.getTime() ) ) {
                this.#isSession = false;
                this.#expires = expires;
                this.#expirationTimestamp = expires.getTime();
            }
        }
    }

    // static
    static new ( options ) {
        if ( options instanceof this ) {
            return options;
        }
        else {
            return new this( options );
        }
    }

    // properties
    get name () {
        return ( this.#name ??= decodeURIComponent( this.#encodedName ) );
    }

    get value () {
        return ( this.#value ??= decodeURIComponent( this.#encodedValue ) );
    }

    get domain () {
        return this.#domain;
    }

    get path () {
        return this.#path;
    }

    get maxAge () {
        return this.#maxAge;
    }

    get expires () {
        return this.#expires;
    }

    get secure () {
        return this.#secure;
    }

    get httpOnly () {
        return this.#httpOnly;
    }

    get partitioned () {
        return this.#partitioned;
    }

    get sameSite () {
        return this.#sameSite;
    }

    get isSession () {
        return this.#isSession;
    }

    get isExpired () {
        if ( this.#isExpired == null ) {
            if ( !this.#expirationTimestamp ) {
                this.#isExpired = false;
            }
            else if ( this.#expirationTimestamp <= Date.now() ) {
                this.#isExpired = true;
            }
            else {
                return false;
            }
        }

        return this.#isExpired;
    }

    get expirationTimestamp () {
        return this.#expirationTimestamp;
    }

    // public
    toString () {
        return JSON.stringify( this.toJSON(), null, 4 );
    }

    toJSON () {
        return {
            "name": this.name,
            "value": this.value,
            "domain": this.#domain,
            "path": this.#path,
            "maxAge": this.#maxAge,
            "expires": this.#expires,
            "secure": this.#secure,
            "httpOnly": this.#httpOnly,
            "partitioned": this.#partitioned,
            "sameSite": this.#sameSite,
        };
    }

    toCookieHeader () {
        if ( !this.#cookieHeader ) {
            this.#cookieHeader = this.#encodeName() + "=" + this.#encodeValue();
        }

        return this.#cookieHeader;
    }

    toSetCookieHeader () {
        if ( !this.#setCookieHeader ) {
            const values = [];

            values.push( this.#encodeName() + "=" + this.#encodeValue() );

            if ( this.#domain ) values.push( "Domain=" + this.#domain );

            if ( this.#path ) values.push( "Path=" + this.#path );

            if ( this.#maxAge != null ) {
                values.push( "Max-Age=" + this.#maxAge );
            }
            else if ( this.#expires ) {
                values.push( "Expires=" + this.#expires.toUTCString() );
            }

            if ( this.#secure ) values.push( "Secure" );

            if ( this.#httpOnly ) values.push( "HttpOnly" );

            if ( this.#partitioned ) values.push( "Partitioned" );

            if ( this.#sameSite ) values.push( "SameSite=" + SAME_SITE[ this.#sameSite ] );

            this.#setCookieHeader = values.join( "; " );
        }

        return this.#setCookieHeader;
    }

    [ util.inspect.custom ] ( depth, options ) {
        return this.toString();
    }

    // private
    // forbidden chars: \x00-\x1F, \x7F, \s, \t, ( ) < > @ , ; : \ " / [ ] ? = { }
    #encodeName () {
        return ( this.#encodedName ??= encodeURIComponent( this.#name ) );
    }

    // value cant't contain ";"
    // value must be quoted if contains leading/trailing spaces
    // forbidden chars: \x00-\x1F, \x7F, \s, \t, " , ; \
    #encodeValue () {
        return ( this.#encodedValue ??= encodeURIComponent( this.#value ) );

        // var value = this.#value.replaceAll( /([\x00-\x1F;\x7F])/g, match => "%" + match.charCodeAt( 0 ).toString( 16 ).padStart( 2, "0" ).toUpperCase() );

        // if ( value.startsWith( " " ) || value.endsWith( " " ) ) {
        //     value = '"' + value + '"';
        // }
    }
}
