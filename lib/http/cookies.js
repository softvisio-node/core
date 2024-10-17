import Hostname from "#lib/hostname";
import Cookie from "#lib/http/cookie";
import { objectIsEmpty } from "#lib/utils";

// NOTE http://bayou.io/draft/cookie.domain.html

export default class Cookies {
    #cookies = {};

    // public
    addCookies ( cookies ) {
        if ( cookies instanceof this ) {
            cookies = cookies.toJSON();
        }

        for ( const domain in cookies ) {
            for ( const path in cookies[ domain ] ) {
                for ( const name in cookies[ domain ][ path ] ) {
                    const cookie = Cookie.new( cookies[ domain ][ path ][ name ] );

                    this.#add( domain, path, cookie );
                }
            }
        }
    }

    add ( url, cookies ) {
        if ( !cookies ) return;

        if ( !Array.isArray( cookies ) ) cookies = [ cookies ];

        if ( !( url instanceof URL ) ) url = new URL( url );

        const urlIsSecure = url.protocol === "https:",
            originDomain = new Hostname( url.hostname );

        var pathname = decodeURIComponent( url.pathname );
        if ( !pathname.endsWith( "/" ) ) pathname += "/";

        for ( let cookie of cookies ) {
            cookie = Cookie.new( cookie );

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
                    if ( !( "." + cookie.domain.ascii ).endsWith( "." + originDomain.ascii ) ) {
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

    delete ( { domain, path, name, session, expired } = {} ) {
        return this.#delete( { domain, path, name, session, expired } );
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
            this.#delete( {
                domain,
                path,
                "name": cookie.name,
            } );
        }
        else {
            this.#cookies[ domain ] ??= {};
            this.#cookies[ domain ][ path ] ??= {};
            this.#cookies[ domain ][ path ][ cookie.name ] = cookie;
        }
    }

    #delete ( { domain, path, name, session, expired } = {} ) {

        // no domain or match sub-domains
        if ( domain == null || domain.startsWith( "." ) ) {
            for ( const _domain in this.#cookies ) {

                // match domain and sub-domains
                if ( domain != null ) {
                    if ( !( "." + _domain ).endsWith( domain ) ) {
                        continue;
                    }
                }

                this.#deleteDomainCookies( _domain, { path, name, session, expired } );
            }
        }

        // strict match domain
        else {
            this.#deleteDomainCookies( domain, { path, name, session, expired } );
        }
    }

    #deleteDomainCookies ( domain, { path, name, session, expired } = {} ) {

        // domain not exists
        if ( !this.#cookies[ domain ] ) {
            return;
        }

        // domain exists
        else {
            var deleted;

            if ( path == null ) {

                // no filters, delete full domain
                if ( name == null && !session && !expired ) {
                    delete this.#cookies[ domain ];

                    return true;
                }
                else {
                    for ( const _path in this.#cookies[ domain ] ) {
                        if ( this.#deleteDomainPathCookies( domain, _path, { name, session, expired } ) ) {
                            deleted = true;
                        }
                    }
                }
            }

            // delete path by name
            else {
                if ( this.#deleteDomainPathCookies( domain, path, { name, session, expired } ) ) {
                    deleted = true;
                }
            }

            // delete domain if empty
            if ( deleted && objectIsEmpty( this.#cookies[ domain ] ) ) {
                delete this.#cookies[ domain ];

                return true;
            }
        }
    }

    #deleteDomainPathCookies ( domain, path, { name, session, expired } = {} ) {

        // path not exists
        if ( !this.#cookies[ domain ]?.[ path ] ) {
            return;
        }

        // no filters, delete full path
        else if ( name == null && !session && !expired ) {
            delete this.#cookies[ domain ][ path ];

            return true;
        }

        // filter cookies
        else {
            let deleted;

            // delete cookie by name
            if ( name != null && this.#cookies[ domain ][ path ][ name ] ) {
                delete this.#cookies[ domain ][ path ][ name ];

                deleted = true;
            }

            // delete session and expired cookies
            if ( session || expired ) {
                for ( const _name in this.#cookies[ domain ][ path ] ) {
                    const cookie = this.#cookies[ domain ][ path ][ _name ];

                    if ( ( session && cookie.isSession ) || ( expired && cookie.isExpired ) ) {
                        delete this.#cookies[ domain ][ path ][ _name ];

                        deleted = true;
                    }
                }
            }

            // delete path if empty
            if ( deleted && objectIsEmpty( this.#cookies[ domain ][ path ] ) ) {
                delete this.#cookies[ domain ][ path ];

                return true;
            }
        }
    }
}

export const cookies = new Cookies();
