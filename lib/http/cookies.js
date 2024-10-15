import Hostname from "#lib/hostname";
import { objectIsEmpty } from "#lib/utils";

// NOTE http://bayou.io/draft/cookie.domain.html

export default class Cookies {
    #cookies = {};

    // public
    add ( cookies, url ) {
        if ( !cookies ) return;

        if ( !( url instanceof URL ) ) url = new URL( url );

        const urlIsSecure = url.protocol === "https:",
            originDomain = new Hostname( url.hostname );

        var pathname = decodeURIComponent( url.pathname );
        if ( !pathname.endsWith( "/" ) ) pathname += "/";

        for ( const cookie of cookies ) {
            if ( cookie.name.startsWith( "__Secure-" ) ) {
                if ( !cookie.secure || !urlIsSecure ) continue;
            }
            else if ( cookie.name.startsWith( "__Host-" ) ) {
                if ( !cookie.secure || !urlIsSecure || cookie.domain || ( cookie.path && cookie.path !== "/" ) ) continue;
            }

            let domain;

            // domain
            if ( cookie.domain ) {

                // domain is not valid
                if ( !cookie.domain.isValid ) {
                    continue;
                }

                // if the origin domain is an IP, the cover domain must be null
                // a cookie with an IP origin is only applicable to that IP
                else if ( originDomain.isIp ) {
                    if ( cookie.domain.ipAddress.ne( originDomain.ipAddress ) ) {
                        continue;
                    }
                }

                // Only the current domain can be set as the value,
                // or a domain of a higher order,
                // unless it is a public suffix
                else if ( cookie.domain.ascii !== originDomain.ascii ) {

                    // not a subdomain of the origin domain
                    if ( !( "." + originDomain.ascii ).endsWith( "." + cookie.domain.ascii ) ) {
                        continue;
                    }

                    // subdomain is a public suffix
                    else if ( cookie.domain.isPublicSuffix ) {
                        continue;
                    }
                }

                domain = cookie.domain.ascii;
            }
            else {
                domain = originDomain.ascii;
            }

            // path
            let path = cookie.path || pathname || "/";
            if ( !path.endsWith( "/" ) ) path += "/";

            // not secure sites can't set secure cookies
            if ( domain !== "localhost" && cookie.secure && !urlIsSecure ) continue;

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

    get ( url ) {
        if ( !( url instanceof URL ) ) url = new URL( url );

        const cookies = [],
            urlIsSecure = url.protocol === "https:";

        var hostname,
            pathname = decodeURIComponent( url.pathname );

        if ( !pathname.endsWith( "/" ) ) pathname += "/";

        while ( true ) {
            if ( !hostname ) {
                hostname = new Hostname( url.hostname );
            }
            else {
                hostname = hostname.parent;

                if ( !hostname ) break;
            }

            const domain = hostname.ascii;

            if ( !this.#cookies[ domain ] ) continue;

            for ( const path in this.#cookies[ domain ] ) {
                if ( pathname.startsWith( path ) ) {
                    for ( const cookie of Object.values( this.#cookies[ domain ][ path ] ) ) {

                        // cookie is expired
                        if ( cookie.isExpired ) {
                            this.delete( {
                                domain,
                                path,
                                "name": cookie.name,
                            } );

                            continue;
                        }

                        if ( domain !== "localhost" && cookie.secure && !urlIsSecure ) continue;

                        if ( cookie.name.startsWith( "__Host-" ) ) {
                            if ( domain !== url.hostname ) continue;
                        }

                        // XXX if domain set in cookie - match subdomains
                        // XXX else match domain only
                        if ( cookie.domain ) {

                            //
                        }
                        else if ( domain !== url.hostname ) {
                            continue;
                        }

                        cookies.push( cookie.toCookieHeader() );
                    }
                }
            }
        }

        return cookies.join( "; " );
    }

    // XXX
    delete ( { domain, path, name, session, expired } = {} ) {
        if ( !path.endsWith( "/" ) ) path += "/";

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
