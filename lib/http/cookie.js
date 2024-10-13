import util from "node:util";
import Interval from "#lib/interval";

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
        this.#path = path;
        this.#secure = !!secure;
        this.#httpOnly = !!httpOnly;
        this.#partitioned = !!partitioned;
        this.#sameSite = SAME_SITE[ sameSite?.toLowerCase() ]
            ? sameSite
            : null;

        // domain should not start with "."
        if ( this.#domain?.startsWith( "." ) ) {
            this.#domain = this.#domain.slice( 1 );
        }

        // max age
        if ( maxAge != null ) {
            try {
                maxAge = Interval.new( maxAge, { "unit": "second" } ).toSeconds();

                this.#isSession = false;
                this.#maxAge = maxAge;
                this.#expirationTimestamp = Date.now() + maxAge * 1000;
            }
            catch {}
        }

        if ( expires != null && this.#maxAge == null ) {
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
        if ( this.#name == null ) {
            try {
                this.#name = this.#encodedName == null
                    ? ""
                    : decodeURIComponent( this.#encodedName );
            }
            catch {
                this.#name = this.#encodedName ?? "";
            }
        }

        return this.#name;
    }

    get value () {
        if ( this.#value == null ) {
            try {
                this.#value = this.#encodedValue == null
                    ? ""
                    : decodeURIComponent( this.#encodedValue );
            }
            catch {
                this.#value = this.#encodedValue ?? "";
            }
        }

        return this.#value;
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
        return this.toCookieHeader();
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
            this.#cookieHeader = this.#encodeName() === ""
                ? this.#encodeValue()
                : this.#encodeName() + "=" + this.#encodeValue();
        }

        return this.#cookieHeader;
    }

    toSetCookieHeader () {
        if ( !this.#setCookieHeader ) {
            const values = [];

            values.push( this.#encodeName() === ""
                ? this.#encodeValue()
                : this.#encodeName() + "=" + this.#encodeValue() );

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
        return JSON.stringify( this.toJSON(), null, 4 );
    }

    // private
    #encodeName () {
        if ( this.#encodedName == null ) {
            if ( this.#name == null ) {
                this.#encodedName = "";
            }
            else {

                // this.#encodedName = encodeURIComponent( this.#name );

                this.#encodedName = this.#name.replaceAll( /([\s\x00-\x1F"%(),/:;<=>?@[\\\]{}\x7F-\xFF])/g, match => "%" + match.charCodeAt( 0 ).toString( 16 ).toUpperCase().padStart( 2, "0" ) );
            }
        }

        return this.#encodedName;
    }

    #encodeValue () {
        if ( this.#encodedValue == null ) {
            if ( this.#value == null ) {
                this.#encodedValue = "";
            }
            else {

                // this.#encodedValue = encodeURIComponent( this.#value );

                this.#encodedValue = this.#value.replaceAll( /([\s\x00-\x1F"%,;\\\x7F-\xFF])/g, match => "%" + match.charCodeAt( 0 ).toString( 16 ).toUpperCase().padStart( 2, "0" ) );
            }
        }

        return this.#encodedValue;
    }
}
