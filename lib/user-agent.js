import CacheLru from "#lib/cache/lru";
import { readConfig } from "#lib/config";
import externalResources from "#lib/external-resources";

const CACHE = new CacheLru( { "maxSize": 1000 } ),
    RESOURCE = await externalResources
        .add( "softvisio-node/core/resources/user-agent" )
        .on( "update", resource => {
            CACHE.clear();

            resource.data = null;
        } )
        .check(),
    CHROME_PLATFORMS = {
        "android": {
            "platform": "Linux; Android 10; K",
            "os": "Android",
            "mobile": true,
        },
        "darwin": {
            "platform": "Macintosh; Intel Mac OS X 10_15_7",
            "os": "macOS",
            "mobile": false,
        },
        "linux": {
            "platform": "X11; Linux x86_64",
            "os": "Linux",
            "mobile": false,
        },
        "win32": {
            "platform": "Windows NT 10.0; Win64; x64",
            "os": "Windows",
            "mobile": false,
        },
    },
    OS_PLATFORM = {
        "android": "android",
        "linux": "linux",
        "mac os x": "darwin",
        "windows": "win32",
    },
    CHROMIUM_BRANDS = {
        "chromium": {
            "name": "Chromium",
            "fullName": "Chromium",
        },
        "chrome": {
            "name": "Chrome",
            "fullName": "Google Chrome",
        },
        "chrome mobile": {
            "name": "Chrome",
            "fullName": "Google Chrome",
        },
        "google chrome": {
            "name": "Chrome",
            "fullName": "Google Chrome",
        },
        "edge": {
            "name": "Edge",
            "fullName": "Microsoft Edge",
        },
        "microsoft edge": {
            "name": "Edge",
            "fullName": "Microsoft Edge",
        },
    },
    CHROMIUM_BRANDS_ORDER = {
        "1": [
            [ 0, 1 ],
            [ 1, 0 ],
        ],
        "2": [
            [ 0, 1, 2 ],
            [ 0, 2, 1 ],
            [ 1, 0, 2 ],
            [ 1, 2, 0 ],
            [ 2, 0, 1 ],
            [ 2, 1, 0 ],
        ],
        "3": [
            [ 0, 1, 2, 3 ],
            [ 0, 1, 3, 2 ],
            [ 0, 2, 1, 3 ],
            [ 0, 2, 3, 1 ],
            [ 0, 3, 1, 2 ],
            [ 0, 3, 2, 1 ],
            [ 1, 0, 2, 3 ],
            [ 1, 0, 3, 2 ],
            [ 1, 2, 0, 3 ],
            [ 1, 2, 3, 0 ],
            [ 1, 3, 0, 2 ],
            [ 1, 3, 2, 0 ],
            [ 2, 0, 1, 3 ],
            [ 2, 0, 3, 1 ],
            [ 2, 1, 0, 3 ],
            [ 2, 1, 3, 0 ],
            [ 2, 3, 0, 1 ],
            [ 2, 3, 1, 0 ],
            [ 3, 0, 1, 2 ],
            [ 3, 0, 2, 1 ],
            [ 3, 1, 0, 2 ],
            [ 3, 1, 2, 0 ],
            [ 3, 2, 0, 1 ],
            [ 3, 2, 1, 0 ],
        ],
    };

function getResources ( name ) {
    RESOURCE.data ??= readConfig( RESOURCE.getResourcePath( "regexes.json" ) );

    if ( !( RESOURCE.data[ name ][ 0 ][ 0 ] instanceof RegExp ) ) {
        for ( const row of RESOURCE.data[ name ] ) {
            if ( Array.isArray( row[ 0 ] ) ) {
                row[ 0 ] = new RegExp( ...row[ 0 ] );
            }
            else {
                row[ 0 ] = new RegExp( row[ 0 ] );
            }
        }
    }

    return RESOURCE.data[ name ];
}

class UserAgentData {
    #userAgent;

    constructor ( userAgent ) {
        this.#userAgent = userAgent;
    }

    // properties
    get userAgent () {
        return this.#userAgent;
    }
}

class UserAgentBrowser extends UserAgentData {
    #parsed;
    #family = null;
    #majorVersion = null;
    #version = null;
    #name;

    // properties
    get family () {
        if ( !this.#parsed ) this.#parse();

        return this.#family;
    }

    get majorVersion () {
        if ( !this.#parsed ) this.#parse();

        return this.#majorVersion;
    }

    get version () {
        if ( !this.#parsed ) this.#parse();

        return this.#version;
    }

    get name () {
        if ( this.#name === undefined ) {
            this.#name = null;

            if ( this.family ) {
                this.#name = this.family;

                if ( this.version ) {
                    this.#name += " " + this.version;
                }
            }
        }

        return this.#name;
    }

    // public
    toString () {
        return this.name;
    }

    toJSON () {
        return {
            "family": this.family,
            "majorVersion": this.majorVersion,
            "version": this.version,
        };
    }

    // private
    #parse () {
        if ( this.#parsed ) return;
        this.#parsed = true;

        const userAgent = this.userAgent.userAgent;
        if ( !userAgent ) return;

        for ( const row of getResources( "browser" ) ) {
            const match = row[ 0 ].exec( userAgent );

            if ( match ) {
                this.#family = row[ 1 ]?.replaceAll( /\$(\d+)/g, ( string, index ) => match[ index ] ) ?? match[ 1 ];

                const major = row[ 2 ]?.replaceAll( /\$(\d+)/g, ( string, index ) => match[ index ] ) ?? match[ 2 ] ?? null,
                    minor = row[ 3 ]?.replaceAll( /\$(\d+)/g, ( string, index ) => match[ index ] ) ?? match[ 3 ] ?? null,
                    patch = row[ 4 ]?.replaceAll( /\$(\d+)/g, ( string, index ) => match[ index ] ) ?? match[ 4 ] ?? null,
                    build = row[ 5 ]?.replaceAll( /\$(\d+)/g, ( string, index ) => match[ index ] ) ?? match[ 5 ] ?? null;

                if ( major == null ) {
                    this.#majorVersion = null;
                    this.#version = null;
                }
                else {
                    this.#majorVersion = +major;

                    this.#version = major;

                    if ( minor != null ) {
                        this.#version += "." + minor;

                        if ( patch != null ) {
                            this.#version += "." + patch;

                            if ( build != null ) {
                                this.#version += "." + build;
                            }
                        }
                    }
                }

                break;
            }
        }
    }
}

class UserAgentOs extends UserAgentData {
    #parsed;
    #family = null;
    #majorVersion = null;
    #version = null;
    #name;

    // properties
    get family () {
        if ( !this.#parsed ) this.#parse();

        return this.#family;
    }

    get majorVersion () {
        if ( !this.#parsed ) this.#parse();

        return this.#majorVersion;
    }

    get version () {
        if ( !this.#parsed ) this.#parse();

        return this.#version;
    }

    get name () {
        if ( this.#name === undefined ) {
            this.#name = null;

            if ( this.family ) {
                this.#name = this.family;

                if ( this.version ) {
                    this.#name += " " + this.version;
                }
            }
        }

        return this.#name;
    }

    // public
    toString () {
        return this.name;
    }

    toJSON () {
        return {
            "family": this.family,
            "majorVersion": this.majorVersion,
            "version": this.version,
        };
    }

    // private
    #parse () {
        if ( this.#parsed ) return;
        this.#parsed = true;

        const userAgent = this.userAgent.userAgent;
        if ( !userAgent ) return;

        for ( const row of getResources( "os" ) ) {
            const match = row[ 0 ].exec( userAgent );

            if ( match ) {
                this.#family = row[ 1 ]?.replaceAll( /\$(\d+)/g, ( string, index ) => match[ index ] ) ?? match[ 1 ];

                const major = row[ 2 ]?.replaceAll( /\$(\d+)/g, ( string, index ) => match[ index ] ) ?? match[ 2 ] ?? null,
                    minor = row[ 3 ]?.replaceAll( /\$(\d+)/g, ( string, index ) => match[ index ] ) ?? match[ 3 ] ?? null,
                    patch = row[ 4 ]?.replaceAll( /\$(\d+)/g, ( string, index ) => match[ index ] ) ?? match[ 4 ] ?? null,
                    build = row[ 5 ]?.replaceAll( /\$(\d+)/g, ( string, index ) => match[ index ] ) ?? match[ 5 ] ?? null;

                this.#majorVersion = major == null
                    ? null
                    : +major;

                if ( major == null ) {
                    this.#majorVersion = null;
                    this.#version = null;
                }
                else {
                    this.#majorVersion = +major;

                    this.#version = major;

                    if ( minor != null ) {
                        this.#version += "." + minor;

                        if ( patch != null ) {
                            this.#version += "." + patch;

                            if ( build != null ) {
                                this.#version += "." + build;
                            }
                        }
                    }
                }

                break;
            }
        }
    }
}

class UserAgentDevice extends UserAgentData {
    #parsed;
    #family = null;
    #vendor = null;
    #model = null;
    #name;

    // properties
    get family () {
        if ( !this.#parsed ) this.#parse();

        return this.#family;
    }

    get vendor () {
        if ( !this.#parsed ) this.#parse();

        return this.#vendor;
    }

    get model () {
        if ( !this.#parsed ) this.#parse();

        return this.#model;
    }

    get name () {
        if ( this.#name === undefined ) {
            this.#name = [ this.vendor, this.model ].filter( tag => tag ).join( " " ) || null;
        }

        return this.#name;
    }

    // public
    toString () {
        return this.name;
    }

    toJSON () {
        return {
            "family": this.family,
            "vendor": this.vendor,
            "model": this.model,
        };
    }

    // private
    #parse () {
        if ( this.#parsed ) return;
        this.#parsed = true;

        const userAgent = this.userAgent.userAgent;
        if ( !userAgent ) return;

        for ( const row of getResources( "device" ) ) {
            const match = row[ 0 ].exec( userAgent );

            if ( match ) {
                this.#family = row[ 1 ]?.replaceAll( /\$(\d+)/g, ( string, index ) => match[ index ] ) ?? match[ 1 ] ?? null;

                this.#vendor = row[ 2 ]?.replaceAll( /\$(\d+)/g, ( string, index ) => match[ index ] ) ?? match[ 2 ] ?? null;

                this.#model = row[ 3 ]?.replaceAll( /\$(\d+)/g, ( string, index ) => match[ index ] ) ?? match[ 3 ] ?? null;

                break;
            }
        }
    }
}

export default class UserAgent {
    #userAgent;
    #reducedUserAgent;
    #isChromium;
    #browser;
    #os;
    #device;

    constructor ( userAgent ) {
        this.#userAgent = userAgent;
    }

    // static
    static new ( userAgent ) {
        if ( userAgent instanceof this ) return userAgent;

        var ua = CACHE.get( userAgent );

        if ( !ua ) {
            ua = new this( userAgent );

            CACHE.set( userAgent, ua );
        }

        return ua;
    }

    static get chromePlatforms () {
        return CHROME_PLATFORMS;
    }

    // https://developers.google.com/privacy-sandbox/blog/user-agent-reduction-android-model-and-version
    static createChromiumUserAgentString ( brand, platform, userAgentVersion ) {
        const majorVersion = userAgentVersion.toString().split( "." )[ 0 ];

        // resolve brand
        brand = CHROMIUM_BRANDS[ brand.toLowerCase() ]?.name;
        if ( !brand ) throw new Error( `Chromium brand is not valid` );

        // resolve platform
        platform = OS_PLATFORM[ platform.toLowerCase() ] || platform;
        if ( !platform ) throw new Error( `Chromium platform is not valid` );

        if ( brand === "Chromium" ) {
            return `Mozilla/5.0 (${ CHROME_PLATFORMS[ platform ].platform }) AppleWebKit/537.36 (KHTML, like Gecko) Chromium/${ majorVersion }.0.0.0${ CHROME_PLATFORMS[ platform ].mobile
                ? " Mobile"
                : "" } Safari/537.36`;
        }
        else if ( brand === "Chrome" ) {
            return `Mozilla/5.0 (${ CHROME_PLATFORMS[ platform ].platform }) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${ majorVersion }.0.0.0${ CHROME_PLATFORMS[ platform ].mobile
                ? " Mobile"
                : "" } Safari/537.36`;
        }
        else if ( brand === "Edge" ) {
            return `Mozilla/5.0 (${ CHROME_PLATFORMS[ platform ].platform }) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${ majorVersion }.0.0.0${ CHROME_PLATFORMS[ platform ].mobile
                ? " Mobile"
                : "" } Safari/537.36 Edg/${ majorVersion }`;
        }
    }

    // https://source.chromium.org/chromium/chromium/src/+/master:components/embedder_support/user_agent_utils.cc;l=55-100
    static createChromiumBrands ( brands, userAgentVersion, useFullVersion ) {
        if ( !Array.isArray( brands ) ) brands = [ brands ];

        brands = new Set( brands.map( brand => CHROMIUM_BRANDS[ brand?.toLowerCase() ]?.fullName ).filter( brand => brand ) );

        if ( !brands.size || brands.size > 3 ) return [];

        brands.add( "Chromium" );

        const seed = Number( userAgentVersion.split( "." )[ 0 ] ),
            version = useFullVersion
                ? userAgentVersion
                : seed.toString(),
            order = CHROMIUM_BRANDS_ORDER[ brands.size ][ seed % CHROMIUM_BRANDS_ORDER[ brands.size ].length ],
            greaseyChars = [ " ", "(", ":", "-", ".", "/", ")", ";", "=", "?", "_" ],
            greasedVersions = [ "8", "99", "24" ],
            greasedBrandVersionList = [];

        let n = 0;

        // add brands
        for ( const brand of brands ) {
            greasedBrandVersionList[ order[ n ] ] = {
                brand,
                version,
            };

            n += 1;
        }

        // add "not a brand"
        greasedBrandVersionList[ order[ n ] ] = {
            "brand": `Not${ greaseyChars[ seed % greaseyChars.length ] }A${ greaseyChars[ ( seed + 1 ) % greaseyChars.length ] }Brand`,
            "version": greasedVersions[ seed % greasedVersions.length ],
        };

        return greasedBrandVersionList;
    }

    // properties
    get userAgent () {
        return this.#userAgent;
    }

    get reducedUserAgent () {
        if ( this.#reducedUserAgent == null ) {
            if ( this.isChromium ) {
                this.#reducedUserAgent = this.constructor.createChromiumUserAgentString( this.browser.family, this.os.family, this.browser.version );
            }
            else {
                this.#reducedUserAgent = this.userAgent;
            }
        }

        return this.#reducedUserAgent;
    }

    get isChromium () {
        this.#isChromium ??= /chrom(?:e|ium)/i.test( this.userAgent.userAgent );

        return this.#isChromium;
    }

    get browser () {
        this.#browser ??= new UserAgentBrowser( this );

        return this.#browser;
    }

    get os () {
        this.#os ??= new UserAgentOs( this );

        return this.#os;
    }

    get device () {
        this.#device ??= new UserAgentDevice( this );

        return this.#device;
    }

    // public
    toString () {
        return this.userAgent;
    }

    toJSON () {
        return {
            "userAgent": this.userAgent,
            "isChromium": this.isChromium,
            "browser": this.browser.toJSON(),
            "os": this.os.toJSON(),
            "device": this.device.toJSON(),
        };
    }

    createChromiumBrands ( useFullVersion ) {
        return this.constructor.createChromiumBrands( this.browser.family, this.browser.version, useFullVersion );
    }
}
