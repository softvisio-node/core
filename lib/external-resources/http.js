import Browser from "#lib/browser";
import * as certificates from "#lib/certificates";
import * as config from "#lib/config";
import ExternalRecourceBuilder from "#lib/external-resource-builder";
import Headers from "#lib/http/headers";
import Server from "#lib/http/server";

const PLATFORMS = {
    "linux": "(X11; Linux x86_64)",
    "win32": "(Windows NT 10.0; Win64; x64)",
};

export default class Http extends ExternalRecourceBuilder {
    #data = {};

    // properties
    get id () {
        return "softvisio-node/core/resources/http";
    }

    // protected
    async _getEtag () {
        const res = await this.#build();
        if ( !res.ok ) return res;

        return result( 200, JSON.stringify( this.#data ) );
    }

    async _build ( location ) {
        config.writeConfig( location + "/http.json", this.#data, { "readable": true } );

        return result( 200 );
    }

    // private
    async #build () {
        var res;

        res = await Browser.installChrome( {
            "chromeHeadlessShell": true,
            "dependencies": true,
            "log": true,
        } );

        if ( !res.ok ) return res;

        var headers;

        // http
        headers = await this.#getHeaders( "chrome-headless-shell", "http:", { "headless": true } );

        // http, win32
        this.#addHeaders( "chrome-win32", "http:", headers, {
            "platform": PLATFORMS.win32,
        } );

        // http, linux
        this.#addHeaders( "chrome-linux", "http:", headers, {
            "platform": PLATFORMS.linux,
        } );

        // https
        headers = await this.#getHeaders( "chrome-headless-shell", "https:", { "headless": true } );

        // https, win32
        this.#addHeaders( "chrome-win32", "https:", headers, {
            "platform": PLATFORMS.win32,
            "Sec-CH-UA-Platform": '"Windows"',
        } );

        // https, linux
        this.#addHeaders( "chrome-linux", "https:", headers, {
            "platform": PLATFORMS.linux,
            "Sec-CH-UA-Platform": '"Linux"',
        } );

        return result( 200 );
    }

    async #getHeaders ( browser, protocol, { headless = false } = {} ) {
        return new Promise( resolve => {
            var server, browser;

            server = new Server( {
                "certificatePath": protocol === "https:"
                    ? certificates.localCertificatePath
                    : null,
                "privateKeyPath": certificates.localPrivateKeyPath,
            } ).get( "/*", async req => {
                await req.end();

                browser?.close();

                await server.stop();

                resolve( req.headers );
            } );

            server.start( { "port": 0 } ).then( async res => {
                if ( !res.ok ) throw res + "";

                const url = `${ protocol }//${ certificates.localDomain }:${ res.data.port }/`;

                browser = new Browser( url, {
                    browser,
                    headless,
                } );
            } );
        } );
    }

    #addHeaders ( browser, protocol, headers, { platform, ...additionalHeaders } = {} ) {
        this.#data[ browser ] ??= {
            "userAgent": null,
        };
        this.#data[ browser ][ protocol ] = {};

        // clone headers
        headers = new Headers( {
            ...headers.toJSON(),
            "Accept-Language": "en-US,en;q=0.9",
            ...additionalHeaders,
        } );

        for ( const [ name, value ] of [ ...headers.entries() ].sort( ( a, b ) => a[ 0 ].localeCompare( b[ 0 ] ) ) ) {
            const originalName = headers.getOriginalName( name );

            if ( name === "user-agent" ) {
                this.#data[ browser ][ "userAgent" ] = value.replaceAll( "Headless", "" );

                // patch platform
                if ( platform ) {
                    if ( this.#data[ browser ][ "userAgent" ].includes( PLATFORMS.linux ) ) {
                        this.#data[ browser ][ "userAgent" ] = this.#data[ browser ][ "userAgent" ].replace( PLATFORMS.linux, platform );
                    }
                    else if ( this.#data[ browser ][ "userAgent" ].includes( PLATFORMS.win32 ) ) {
                        this.#data[ browser ][ "userAgent" ] = this.#data[ browser ][ "userAgent" ].replace( PLATFORMS.win32, platform );
                    }
                    else {
                        throw new Error( `Unable to patch platform for user agent: ${ value }` );
                    }
                }
            }
            else if ( name === "dnt" ) {
                this.#data[ browser ][ protocol ][ originalName ] = value;
            }
            else if ( name === "accept" ) {
                this.#data[ browser ][ protocol ][ originalName ] = value;
            }
            else if ( name === "accept-language" ) {
                this.#data[ browser ][ protocol ][ originalName ] = value;
            }
            else if ( name.startsWith( "sec-" ) ) {
                this.#data[ browser ][ protocol ][ originalName ] = value.replaceAll( "Headless", "" );
            }
        }
    }
}
