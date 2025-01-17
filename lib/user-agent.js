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
        .check();

const CHROMIUM_BRANDS = {
    "chrome": "Google Chrome",
    "edge": "Microsoft Edge",
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
    #isChromium;

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

    get isChromium () {
        this.#isChromium ??= /chrom(?:e|ium)/i.test( this.userAgent.userAgent );

        return this.#isChromium;
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
            "isChromium": this.isChromium,
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

class UserAgent {
    #userAgent;
    #browser;
    #os;
    #device;

    constructor ( userAgent ) {
        this.#userAgent = userAgent;
    }

    // static
    static createChromiumBrands ( brand, userAgentVersion, useFullVersion ) {
        brand = CHROMIUM_BRANDS[ brand?.toLowerCase() ] || brand;

        if ( !brand ) return;

        // https://source.chromium.org/chromium/chromium/src/+/master:components/embedder_support/user_agent_utils.cc;l=55-100

        const seed = Number( userAgentVersion.split( "." )[ 0 ] ),
            version = useFullVersion
                ? userAgentVersion
                : seed.toString(),
            order = [
                [ 0, 1, 2 ],
                [ 0, 2, 1 ],
                [ 1, 0, 2 ],
                [ 1, 2, 0 ],
                [ 2, 0, 1 ],
                [ 2, 1, 0 ],
            ][ seed % 6 ],
            greaseyChars = [ " ", "(", ":", "-", ".", "/", ")", ";", "=", "?", "_" ],
            greasedVersions = [ "8", "99", "24" ],
            greasedBrandVersionList = [];

        greasedBrandVersionList[ order[ 0 ] ] = {
            "brand": `Not${ greaseyChars[ seed % greaseyChars.length ] }A${ greaseyChars[ ( seed + 1 ) % greaseyChars.length ] }Brand`,
            "version": greasedVersions[ seed % greasedVersions.length ],
        };

        greasedBrandVersionList[ order[ 1 ] ] = {
            "brand": "Chromium",
            version,
        };

        greasedBrandVersionList[ order[ 2 ] ] = {
            brand,
            version,
        };

        return greasedBrandVersionList;
    }

    // properties
    get userAgent () {
        return this.#userAgent;
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
            "browser": this.browser.toJSON(),
            "os": this.os.toJSON(),
            "device": this.device.toJSON(),
        };
    }

    createChromiumBrands ( useFullVersion ) {
        return this.constructor.createChromiumBrands( this.browser.family, this.browser.version, useFullVersion );
    }
}

export default function parseUserAgent ( userAgent ) {
    if ( userAgent instanceof UserAgent ) return userAgent;

    var ua = CACHE.get( userAgent );

    if ( !ua ) {
        ua = new UserAgent( userAgent );

        CACHE.set( userAgent, ua );
    }

    return ua;
}
