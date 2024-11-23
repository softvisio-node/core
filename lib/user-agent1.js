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

class UserAgentData {
    #userAgent;

    constructor ( userAgent ) {
        this.#userAgent = userAgent;
    }

    // properties
    get userAgent () {
        return this.#userAgent;
    }

    // protected
    _getResources ( name ) {
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
}

class UserAgentBrowser extends UserAgentData {
    #parsed;
    #toString;
    #name;
    #version;
    #majorVersion;

    // properties
    get name () {
        if ( !this.#parsed ) this.#parse();

        return this.#name;
    }

    get version () {
        if ( !this.#parsed ) this.#parse();

        return this.#version;
    }

    get majorVersion () {
        if ( !this.#parsed ) this.#parse();

        return this.#majorVersion;
    }

    // public
    toString () {
        if ( this.#toString === undefined ) {
            this.#toString = null;

            if ( this.name ) {
                this.#toString = this.name;

                if ( this.version ) {
                    this.#toString += " " + this.version;
                }
            }
        }

        return this.#toString;
    }

    toJSON () {
        return {
            "name": this.name,
            "version": this.version,
            "majorVersion": this.majorVersion,
        };
    }

    // private
    // XXX
    #parse () {
        if ( this.#parsed ) return;
        this.#parsed = true;

        const userAgent = this.userAgent.userAgent;

        for ( const row of this._getResources( "browser" ) ) {
            const match = row[ 0 ].exec( userAgent );

            if ( match ) {
                this.#name = row[ 1 ]?.replaceAll( /\$(\d+)/g, ( string, index ) => match[ index ] ) ?? match[ 1 ];

                const major = row[ 2 ]?.replaceAll( /\$(\d+)/g, ( string, index ) => match[ index ] ) ?? match[ 2 ] ?? null,
                    minor = row[ 3 ]?.replaceAll( /\$(\d+)/g, ( string, index ) => match[ index ] ) ?? match[ 3 ] ?? 0,
                    patch = row[ 4 ]?.replaceAll( /\$(\d+)/g, ( string, index ) => match[ index ] ) ?? match[ 4 ] ?? 0;

                this.#version = major == null
                    ? null
                    : major + "." + minor + "." + patch;

                this.#majorVersion = major;

                break;
            }
            else {
                this.#name = "Other";
                this.#version = null;
                this.#majorVersion = null;
            }
        }
    }
}

class UserAgentOs extends UserAgentData {
    #parsed;
    #toString;
    #name;
    #version;

    // properties
    get name () {
        if ( !this.#parsed ) this.#parse();

        return this.#name;
    }

    get version () {
        if ( !this.#parsed ) this.#parse();

        return this.#version;
    }

    // public
    toString () {
        if ( this.#toString === undefined ) {
            this.#toString = null;

            if ( this.name ) {
                this.#toString = this.name;

                if ( this.version ) {
                    this.#toString += " " + this.version;
                }
            }
        }

        return this.#toString;
    }

    toJSON () {
        return {
            "name": this.name,
            "version": this.version,
        };
    }

    // private
    // XXX
    #parse () {
        if ( this.#parsed ) return;
        this.#parsed = true;

        const userAgent = this.userAgent.userAgent;

        for ( const row of this._getResources( "os" ) ) {
            const match = row[ 0 ].exec( userAgent );

            if ( match ) {
                this.#name = row[ 1 ]?.replaceAll( /\$(\d+)/g, ( string, index ) => match[ index ] ) ?? match[ 1 ];

                const major = row[ 2 ]?.replaceAll( /\$(\d+)/g, ( string, index ) => match[ index ] ) ?? match[ 2 ] ?? null,
                    minor = row[ 3 ]?.replaceAll( /\$(\d+)/g, ( string, index ) => match[ index ] ) ?? match[ 3 ] ?? 0,
                    patch = row[ 4 ]?.replaceAll( /\$(\d+)/g, ( string, index ) => match[ index ] ) ?? match[ 4 ] ?? 0;

                this.#version = major == null
                    ? null
                    : major + "." + minor + "." + patch;

                break;
            }
            else {
                this.#name = "Other";
                this.#version = null;
            }
        }
    }
}

class UserAgentDevice extends UserAgentData {

    // public
    toString () {}

    // XXX
    toJSON () {
        return {
            "name": this.name,
            "version": this.version,
        };
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

export default function userAgent ( userAgent ) {
    if ( userAgent instanceof UserAgent ) return userAgent;

    var ua = CACHE.get( userAgent );

    if ( !ua ) {
        ua = new UserAgent( userAgent );

        CACHE.set( userAgent, ua );
    }

    return ua;
}
