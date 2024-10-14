import net from "node:net";
import { objectIsEmpty } from "#lib/utils";

// NOTE http://bayou.io/draft/cookie.domain.html

export default class Cookies {
    #cookies = {}; // XXX Map

    // public
    add ( cookies, url ) {
        if ( !cookies ) return;

        if ( url && !( url instanceof URL ) ) url = new URL( url );

        const originDomain = url?.hostname,
            originDomainIsIp = originDomain
                ? net.isIP( originDomain )
                : null;

        for ( const cookie of cookies ) {
            let domain;

            // domain
            if ( cookie.domain ) {
                domain = cookie.domain;

                if ( originDomain ) {

                    // if the origin domain is an IP, the cover domain must be null
                    // a cookie with an IP origin is only applicable to that IP
                    if ( originDomainIsIp ) {

                        // domain is invalid
                        if ( domain !== originDomain ) continue;
                    }

                    // the cover domain must cover (be a substring) the origin domain
                    else if ( !( "." + originDomain ).endsWith( "." + domain ) ) {
                        continue;
                    }
                }
            }
            else {
                domain = originDomain;
            }

            if ( !domain ) continue;

            // path
            const path = cookie.path || url?.pathname || "/";

            // cookie is expired
            if ( cookie.isExpired ) {
                this.delete( {
                    domain,
                    path,
                    "name": cookie.name,
                } );

                continue;
            }

            // set cookie
            this.#cookies[ domain ] ||= {};
            this.#cookies[ domain ][ path ] ||= {};
            this.#cookies[ domain ][ path ][ cookie.name ] = cookie;
        }
    }

    // XXX
    get ( url ) {
        if ( typeof url === "string" ) url = new URL( url );

        const cookies = [],
            isSecure = url.protocol === "https:",
            labels = net.isIP( url.hostname )
                ? [ url.hostname ]
                : url.hostname.split( "." );

        let domain;

        while ( labels.length ) {
            if ( !domain ) {
                domain = labels.pop();
            }
            else {
                domain = labels.pop() + "." + domain;
            }

            const _domain = this.#cookies[ domain ];

            if ( _domain ) {
                for ( const path in _domain ) {
                    if ( url.pathname.startsWith( path ) ) {
                        const _path = _domain[ path ];

                        for ( const cookie of Object.values( _path ) ) {
                            if ( cookie.secure && !isSecure ) continue;

                            if ( cookie.isExpired ) {
                                this.delete( cookie );

                                continue;
                            }

                            cookies.push( cookie.toCookieHeader() );
                        }
                    }
                }
            }
        }

        return cookies.join( "; " );
    }

    // XXX
    delete ( { domain, path, name, session, expired } = {} ) {
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

    toJSON () {
        return this.#cookies;
    }

    toString () {
        return JSON.stringify( this.#cookies, null, 4 );
    }
}

export const cookies = new Cookies();
