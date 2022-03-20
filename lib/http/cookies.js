import net from "net";

// NOTE http://bayou.io/draft/cookie.domain.html

export default class Cookies {
    #cookies = {};

    // public
    add ( cookies, url ) {
        if ( !cookies ) return;

        if ( !( url instanceof URL ) ) url = new URL( url );

        const date = Date.now();

        for ( let cookie of cookies ) {
            if ( !cookie.name ) continue;

            cookie = { ...cookie };

            // domain
            if ( cookie.domain ) {
                const originDomain = url.hostname;

                // if the origin domain is an IP, the cover domain must be null
                // a cookie with an IP origin is only applicable to that IP
                if ( net.isIP( originDomain ) ) {

                    // domain is invalid
                    if ( cookie.domain !== originDomain ) continue;
                }

                // a cover domain should not contain a leading dot, like in .cats.com; if it does, the client should remove the leading dot
                if ( cookie.domain.startsWith( "." ) ) cookie.domain = cookie.domain.substring( 1 );

                // the cover domain must cover (be a substring) the origin domain
                if ( !( "." + originDomain ).endsWith( "." + cookie.domain ) ) continue;
            }
            else {
                cookie.domain = url.hostname;
            }

            // path
            cookie.path ||= url.pathname;

            // max age
            if ( cookie["max-age"] != null ) {
                cookie.expires = date + cookie["max-age"];
            }

            // expires
            else if ( cookie.expires ) {
                cookie.expires = cookie.expires.getTime();
            }

            // cookies is expired
            if ( cookie.expires && cookie.expires <= date ) {
                this.delete( cookie );

                continue;
            }

            // set cookie
            ( ( this.#cookies[cookie.domain] ||= {} )[cookie.path] ||= {} )[cookie.name] = cookie;
        }
    }

    get ( url ) {
        if ( !( url instanceof URL ) ) url = new URL( url );
    }

    delete ( { domain, path, name } = {} ) {}

    toString () {
        return JSON.stringify( this.#cookies, null, 4 );
    }

    toJSON () {
        return this.#cookies;
    }
}
