import url from "url";
import fs from "fs";
import net from "net";
import { validateDomainName } from "#lib/validate";
import externalResources from "#lib/external-resources";

var RESOURCES;

const PUBLIC_SUFFIXES = await externalResources
    .add( "softvisio-node/core/resources/public-suffixes" )
    .on( "update", () => ( RESOURCES = null ) )
    .check();

const TLD = await externalResources
    .add( "softvisio-node/core/resources/tld" )
    .on( "update", () => ( RESOURCES = null ) )
    .check();

export default class Hostname {
    #domain;

    #unicode;
    #ascii;
    #isValid;
    #isIp;
    #isIpV4;
    #isIpV6;
    #isTld;
    #tld;
    #tldIsValid;
    #publicSuffix;
    #isRootDomain;
    #rootDomain;
    #rootLabel;

    constructor ( domain ) {
        this.#domain = domain.toLowerCase();
    }

    // properties
    get unicode () {
        this.#unicode ??= url.domainToUnicode( this.#domain );

        return this.#unicode;
    }

    get ascii () {
        this.#ascii ??= url.domainToASCII( this.#domain );

        return this.#ascii;
    }

    get isValid () {
        if ( this.#isValid == null ) {
            if ( this.isIp ) {
                this.#isValid = true;
            }
            else if ( this.ascii === "" ) {
                this.#isValid = false;
            }
            else if ( !validateDomainName( this.ascii ).ok ) {
                this.#isValid = false;
            }
            else {
                this.#isValid = true;
            }
        }

        return this.#isValid;
    }

    get isDomain () {
        return !this.isIp;
    }

    get isIp () {
        if ( this.#isIp === undefined ) this.#checkIsIp();

        return this.#isIp;
    }

    get isIpV4 () {
        if ( this.#isIpV4 === undefined ) this.#checkIsIp();

        return this.#isIpV4;
    }

    get isIpV6 () {
        if ( this.#isIpV6 === undefined ) this.#checkIsIp();

        return this.#isIpV6;
    }

    get isTld () {
        if ( this.#isTld === undefined ) {
            if ( !this.tld ) {
                this.#isTld = false;
            }
            else {
                this.#isTld = this.tld.unicode === this.unicode;
            }
        }

        return this.#isTld;
    }

    get tld () {
        if ( this.#tld === undefined ) {
            if ( this.isIp ) {
                this.#tld = null;
            }
            else {
                const idx = this.unicode.lastIndexOf( "." );

                if ( idx < 0 ) this.#tld = this;
                else this.#tld = new this.constructor( this.unicode.substring( idx + 1 ) );
            }
        }

        return this.#tld;
    }

    get tldIsValid () {
        if ( this.#tldIsValid === undefined ) {
            if ( this.isIp ) {
                this.#tldIsValid = false;
            }
            else if ( this.tld ) {
                this.#tldIsValid = this.#resources.has( this.tld.unicode );
            }
            else {
                this.#tldIsValid = this.#resources.has( this.unicode );
            }
        }

        return this.#tldIsValid;
    }

    get isPublicSuffix () {
        return this.publicSuffix && this.publicSuffix.unicode === this.unicode;
    }

    get publicSuffix () {
        if ( this.#publicSuffix === undefined ) {
            this.#publicSuffix = null;

            if ( this.isIp ) {
                this.#publicSuffix = null;
            }
            else if ( this.#resources.has( this.unicode ) ) {
                this.#publicSuffix = this;
            }
            else {
                const labels = this.unicode.split( "." );

                if ( labels.length > 1 ) {
                    let publicSuffix, rootLabel;

                    while ( labels.length > 1 ) {
                        rootLabel = labels.shift();
                        publicSuffix = labels.join( "." );

                        // match wildcard
                        if ( this.#resources.has( "*." + publicSuffix ) ) {
                            const rootDomain = rootLabel + "." + publicSuffix;

                            // not excluded
                            if ( !this.#resources.has( "!" + rootDomain ) ) {
                                publicSuffix = rootDomain;
                            }

                            if ( publicSuffix === this.unicode ) {
                                this.#publicSuffix = this;
                            }
                            else {
                                this.#publicSuffix = new this.constructor( publicSuffix );
                            }

                            break;
                        }

                        if ( this.#resources.has( publicSuffix ) ) {
                            this.#publicSuffix = new this.constructor( publicSuffix );

                            break;
                        }
                    }
                }
            }
        }

        return this.#publicSuffix;
    }

    get isRootDomain () {
        if ( this.#isRootDomain === undefined ) {
            this.#isRootDomain = !!( this.rootDomain && this.rootDomain.unicode === this.unicode );
        }

        return this.#isRootDomain;
    }

    get rootDomain () {
        if ( this.#rootDomain === undefined ) {
            if ( this.rootLabel == null ) {
                this.#rootDomain = null;
            }
            else {
                const rootDomain = this.rootLabel.unicode + "." + this.publicSuffix.unicode;

                if ( rootDomain === this.unicode ) {
                    this.#rootDomain = this;
                }
                else {
                    this.#rootDomain = new this.constructor( rootDomain );
                }
            }
        }

        return this.#rootDomain;
    }

    get rootLabel () {
        if ( this.#rootLabel === undefined ) {
            if ( this.publicSuffix && !this.isPublicSuffix ) {
                const left = this.unicode.slice( 0, -this.publicSuffix.unicode.length - 1 );

                const idx = left.lastIndexOf( "." );

                this.#rootLabel = new this.constructor( left.substring( idx + 1 ) );
            }
            else {
                this.#rootLabel = null;
            }
        }

        return this.#rootLabel;
    }

    // public
    toString () {
        return this.unicode || this.#domain;
    }

    toJSON () {
        return this.toString();
    }

    // private
    get #resources () {
        if ( !RESOURCES ) {
            const list = fs.readFileSync( PUBLIC_SUFFIXES.location + "/public-suffixes.txt", "utf8" );

            RESOURCES = new Set( list.split( "\n" ).filter( rule => rule && !rule.startsWith( "//" ) ) );

            const tlds = fs.readFileSync( TLD.location + "/tld.txt", "utf8" );

            for ( let tld of tlds.split( "\n" ) ) {
                tld = tld.trim();

                if ( !tld || tld.startsWith( "#" ) ) continue;

                tld = url.domainToUnicode( tld.toLowerCase() );

                RESOURCES.add( tld );
            }
        }

        return RESOURCES;
    }

    #checkIsIp () {
        const ip = net.isIP( this.#domain );

        if ( !ip ) {
            this.#isIp = false;
            this.#isIpV4 = false;
            this.#isIpV6 = false;
        }
        else {
            this.#isIp = true;
            this.#isIpV4 = ip === 4;
            this.#isIpV6 = ip === 6;
        }
    }
}
