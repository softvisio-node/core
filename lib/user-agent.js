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

function getResources ( name ) {
    RESOURCE.data ??= readConfig( RESOURCE.location + "/regexes.json" );

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
                    minor = row[ 3 ]?.replaceAll( /\$(\d+)/g, ( string, index ) => match[ index ] ) ?? match[ 3 ] ?? 0,
                    patch = row[ 4 ]?.replaceAll( /\$(\d+)/g, ( string, index ) => match[ index ] ) ?? match[ 4 ] ?? 0;

                this.#majorVersion = major == null
                    ? null
                    : +major;

                this.#version = major == null
                    ? null
                    : major + "." + minor + "." + patch;

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
                    minor = row[ 3 ]?.replaceAll( /\$(\d+)/g, ( string, index ) => match[ index ] ) ?? match[ 3 ] ?? 0,
                    patch = row[ 4 ]?.replaceAll( /\$(\d+)/g, ( string, index ) => match[ index ] ) ?? match[ 4 ] ?? 0,
                    patchMinor = row[ 5 ]?.replaceAll( /\$(\d+)/g, ( string, index ) => match[ index ] ) ?? match[ 5 ] ?? 0;

                this.#majorVersion = major == null
                    ? null
                    : +major;

                this.#version = major == null
                    ? null
                    : major + "." + minor + "." + patch + "." + patchMinor;

                break;
            }
        }
    }
}

class UserAgentDevice extends UserAgentData {
    #parsed;
    #family = null;
    #brand = null;
    #model = null;
    #name;

    // properties
    get family () {
        if ( !this.#parsed ) this.#parse();

        return this.#family;
    }

    get brand () {
        if ( !this.#parsed ) this.#parse();

        return this.#brand;
    }

    get model () {
        if ( !this.#parsed ) this.#parse();

        return this.#model;
    }

    get name () {
        if ( this.#name === undefined ) {
            this.#name = [ this.brand, this.model ].filter( tag => tag ).join( " " ) || null;
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
            "brand": this.brand,
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

                this.#brand = row[ 2 ]?.replaceAll( /\$(\d+)/g, ( string, index ) => match[ index ] ) ?? match[ 2 ] ?? null;

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
