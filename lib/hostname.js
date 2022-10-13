import url from "url";
import fs from "fs";
import net from "net";
import resources from "#lib/resources/core";
import * as validate from "#lib/utils/validate";

var LIST;

resources.on( "update", resource => loadResources( resource ) ).startUpdate();

loadResources();

function loadResources ( resource ) {
    if ( resource && resource.id !== "public-suffix" && resource.id !== "tld" ) return;

    const list = fs.readFileSync( resources.location + "/" + resources.get( "public-suffix" ).files[0], "utf8" );

    LIST = new Set( list.split( "\n" ).filter( rule => rule && !rule.startsWith( "//" ) ) );

    const tlds = fs.readFileSync( resources.location + "/" + resources.get( "tld" ).files[0], "utf8" );

    for ( let tld of tlds.split( "\n" ) ) {
        tld = tld.trim();

        if ( !tld || tld.startsWith( "#" ) ) continue;

        tld = url.domainToUnicode( tld.toLowerCase() );

        LIST.add( tld );
    }
}

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
        this.#unicode ||= url.domainToUnicode( this.#domain );

        return this.#unicode;
    }

    get ascii () {
        this.#ascii ||= url.domainToASCII( this.#domain );

        return this.#ascii;
    }

    get isValid () {
        if ( this.#isValid === undefined ) {
            if ( this.isIp ) {
                this.#isValid = true;
            }
            else {
                this.#isValid = validate.validateDomainName( this.ascii ).ok;
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
                this.#tldIsValid = LIST.has( this.tld.unicode );
            }
            else {
                this.#tldIsValid = LIST.has( this.unicode );
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
            else if ( LIST.has( this.unicode ) ) {
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
                        if ( LIST.has( "*." + publicSuffix ) ) {
                            const rootDomain = rootLabel + "." + publicSuffix;

                            // not excluded
                            if ( !LIST.has( "!" + rootDomain ) ) {
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

                        if ( LIST.has( publicSuffix ) ) {
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
                const left = this.unicode.substring( 0, this.unicode.length - this.publicSuffix.unicode.length - 1 );

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
        return this.unicode;
    }

    toJSON () {
        return this.unicode;
    }

    // private
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
