import Hostname from "#lib/hostname";
import Cookie from "#lib/http/cookie";
import { objectIsEmpty } from "#lib/utils";

// NOTE http://bayou.io/draft/cookie.domain.html

export default class Cookies {
    #cookies = {};

    // public
    addCookies ( data ) {
        for ( const domain in data ) {
            for ( const path in data[ domain ] ) {
                for ( const name in data[ domain ][ path ] ) {
                    const cookie = Cookie.new( data[ domain ][ path ][ name ] );

                    this.#add( domain, path, cookie );
                }
            }
        }
    }

    add ( url, cookies ) {
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

            this.#add( domain, path, cookie );
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

                        // if domain set in cookie - match subdomains
                        // else match domain only
                        if ( !cookie.domain && domain !== url.hostname ) {
                            continue;
                        }

                        if ( domain !== "localhost" && cookie.secure && !urlIsSecure ) continue;

                        if ( cookie.name.startsWith( "__Host-" ) ) {
                            if ( domain !== url.hostname ) continue;
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
        for ( const _domain in this.#cookies ) {
            if ( domain != null ) {
                if ( domain !== _domain ) continue;

                // XXX subdomain
            }

            // delete all domain cookies
            if ( path == null && name == null && !session && !expired ) {
                delete this.#cookies[ _domain ];
            }

            // filter path
            else {
                let pathDeleted;

                for ( const _path in this.#cookies[ _domain ] ) {

                    // path not match
                    if ( path != null && path !== _path ) continue;

                    // delete all path cookies
                    if ( name == null && !session && !expired ) {
                        delete this.#cookies[ _domain ][ _path ];

                        pathDeleted = true;
                    }

                    // filter cookies
                    else {
                        let cookieDeleted;

                        for ( const _name in this.#cookies[ _domain ][ _path ] ) {
                            const cookie = this.#cookies[ _domain ][ _path ][ _name ];

                            if ( name === _name || ( session && cookie.isSession ) || ( expired && cookie.isExpired ) ) {
                                delete this.#cookies[ _domain ][ _path ][ _name ];

                                cookieDeleted = true;
                            }
                        }

                        if ( cookieDeleted && objectIsEmpty( this.#cookies[ _domain ][ _path ] ) ) {
                            delete this.#cookies[ _domain ][ _path ];

                            pathDeleted = true;
                        }
                    }
                }

                if ( pathDeleted && objectIsEmpty( this.#cookies[ _domain ] ) ) {
                    delete this.#cookies[ _domain ];
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

    // private
    #add ( domain, path, cookie ) {
        if ( cookie.isExpired ) {
            this.#delete( domain, path, cookie.name );
        }
        else {
            this.#cookies[ domain ] ??= {};
            this.#cookies[ domain ][ path ] ??= {};
            this.#cookies[ domain ][ path ][ cookie.name ] = cookie;
        }
    }

    #delete ( domain, path, name ) {
        if ( this.#cookies[ domain ]?.[ path ]?.[ name ] ) {
            delete this.#cookies[ domain ][ path ][ name ];

            if ( objectIsEmpty( this.#cookies[ domain ][ path ] ) ) {
                delete this.#cookies[ domain ][ path ];
            }

            if ( objectIsEmpty( this.#cookies[ domain ] ) ) {
                delete this.#cookies[ domain ];
            }
        }
    }
}

export const cookies = new Cookies();
