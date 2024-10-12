import net from "node:net";
import { objectIsEmpty } from "#lib/utils";

// NOTE http://bayou.io/draft/cookie.domain.html

export default class Cookies {
    #cookies = {}; // XXX Map

    // public
    add ( cookies, url ) {
        if ( !cookies ) return;

        if ( url && !( url instanceof URL ) ) url = new URL( url );

        const now = Date.now();

        for ( let cookie of cookies ) {
            if ( !cookie.name ) continue;

            cookie = { ...cookie };

            // domain
            if ( cookie.domain ) {

                // a cover domain should not contain a leading dot, like in .cats.com
                // if it does, the client should remove the leading dot
                if ( cookie.domain.startsWith( "." ) ) cookie.domain = cookie.domain.slice( 1 );

                const originDomain = url?.hostname;

                if ( originDomain ) {

                    // if the origin domain is an IP, the cover domain must be null
                    // a cookie with an IP origin is only applicable to that IP
                    if ( net.isIP( originDomain ) ) {

                        // domain is invalid
                        if ( cookie.domain !== originDomain ) continue;
                    }

                    // the cover domain must cover (be a substring) the origin domain
                    else if ( !( "." + originDomain ).endsWith( "." + cookie.domain ) ) {
                        continue;
                    }
                }
            }
            else {
                if ( !url?.hostname ) continue;

                cookie.domain = url.hostname;
            }

            // path
            cookie.path ||= url?.pathname || "/";

            // max age
            if ( cookie[ "max-age" ] != null ) {
                cookie.expires = now + cookie[ "max-age" ];
            }

            // expires
            else if ( cookie.expires instanceof Date ) {
                cookie.expires = cookie.expires.getTime();
            }

            // cookie is expired
            if ( cookie.expires && cookie.expires <= now ) {
                this.delete( cookie );

                continue;
            }

            // set cookie
            this.#cookies[ cookie.domain ] ||= {};
            this.#cookies[ cookie.domain ][ cookie.path ] ||= {};
            this.#cookies[ cookie.domain ][ cookie.path ][ cookie.name ] = cookie;
        }
    }

    get ( url ) {
        if ( typeof url === "string" ) url = new URL( url );

        const cookies = [],
            isSecure = url.protocol === "https:",
            now = Date.now(),
            labels = net.isIP( url.hostname )
                ? [ url.hostname ]
                : url.hostname.split( "." );

        let domain;

        while ( labels.length ) {
            if ( !domain ) domain = labels.pop();
            else domain = labels.pop() + "." + domain;

            const _domain = this.#cookies[ domain ];

            if ( _domain ) {
                for ( const path in _domain ) {
                    if ( url.pathname.startsWith( path ) ) {
                        const _path = _domain[ path ];

                        for ( const cookie of Object.values( _path ) ) {
                            if ( cookie.secure && !isSecure ) continue;

                            if ( cookie.expires && cookie.expires <= now ) {
                                this.delete( cookie );

                                continue;
                            }

                            cookies.push( `${ cookie.name }=${ cookie.value }` );
                        }
                    }
                }
            }
        }

        return cookies.join( "; " );
    }

    delete ( { domain, path, name } = {} ) {
        const _domain = this.#cookies[ domain ];

        if ( _domain ) {
            if ( !path ) {
                delete this.#cookies[ domain ];
            }
            else {
                const _path = _domain[ path ];

                if ( _path ) {
                    if ( !name ) {
                        delete _domain[ path ];
                    }
                    else {
                        delete _path[ name ];

                        if ( objectIsEmpty( _path ) ) delete _domain[ path ];
                    }

                    if ( objectIsEmpty( _domain ) ) delete this.#cookies[ domain ];
                }
            }
        }
    }

    clear () {
        this.#cookies = {};
    }

    // XXX
    deleteSessionCookies () {}

    toJSON () {
        return this.#cookies;
    }

    toString () {
        return JSON.stringify( this.#cookies, null, 4 );
    }
}

export const cookies = new Cookies();
