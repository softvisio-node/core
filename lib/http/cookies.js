import net from "net";

// NOTE http://bayou.io/draft/cookie.domain.html

export default class Cookies {
    #cookies = new Map();

    // public
    add ( cookies, url ) {
        if ( !cookies ) return;

        if ( !( url instanceof URL ) ) url = new URL( url );

        const now = Date.now();

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
                cookie.expires = now + cookie["max-age"];
            }

            // expires
            else if ( cookie.expires ) {
                cookie.expires = cookie.expires.getTime();
            }

            // cookies is expired
            if ( cookie.expires && cookie.expires <= now ) {
                this.delete( cookie );

                continue;
            }

            // set cookie
            let domain = this.#cookies.get( cookie.domain );
            if ( !domain ) {
                domain = new Map();
                this.#cookies.set( cookie.domain, domain );
            }

            let path = domain.get( cookie.path );
            if ( !path ) {
                path = new Map();
                domain.set( cookie.path, path );
            }

            path.set( cookie.name, cookie );
        }
    }

    get ( url ) {
        if ( !( url instanceof URL ) ) url = new URL( url );

        const cookies = [],
            isSecure = url.protocol === "https:",
            now = Date.now(),
            labels = url.hostname.split( "." );

        let domain;

        while ( labels.length ) {
            if ( !domain ) domain = labels.pop();
            else domain = labels.pop() + "." + domain;

            const _domain = this.#cookies.get( domain );

            if ( _domain ) {
                for ( const path of _domain.keys() ) {
                    if ( url.pathname.startsWith( path ) ) {
                        const _path = _domain.get( path );

                        for ( const cookie of _path.values() ) {
                            if ( cookie.secure && !isSecure ) continue;

                            if ( cookie.expires && cookie.expires <= now ) {
                                this.delete( cookie );

                                continue;
                            }

                            cookies.push( `${cookie.name}=${cookie.value}` );
                        }
                    }
                }
            }
        }

        return cookies.join( "; " );
    }

    delete ( { domain, path, name } = {} ) {
        const _domain = this.#cookies.get( domain );
        if ( _domain ) {
            const _path = _domain.get( path );

            if ( _path ) {
                _path.delete( name );

                if ( !_path.size ) _domain.delete( path );
                if ( !_domain.size ) this.#cookies.delete( domain );
            }
        }
    }
}
