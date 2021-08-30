import url from "url";
import fs from "fs";
import net from "net";
import resources from "#lib/hostname/resources";

var LIST;

resources.on( "update", id => reload() ).startUpdate();

reload();

function reload () {
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
    #isIP;
    #isIPv4;
    #isIPv6;
    #isTLD;
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
            if ( this.isIP ) {
                this.#isValid = true;
            }
            else {
                this.#isValid = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/.test( this.ascii );
            }
        }

        return this.#isValid;
    }

    get isDomain () {
        return !this.isIP;
    }

    get isIP () {
        if ( this.#isIP === undefined ) this.#checkIsIP();

        return this.#isIP;
    }

    get isIPv4 () {
        if ( this.#isIPv4 === undefined ) this.#checkIsIP();

        return this.#isIPv4;
    }

    get isIPv6 () {
        if ( this.#isIPv6 === undefined ) this.#checkIsIP();

        return this.#isIPv6;
    }

    get isTLD () {
        if ( this.#isTLD === undefined ) {
            if ( !this.tld ) {
                this.#isTLD = false;
            }
            else {
                this.#isTLD = this.tld.unicode === this.unicode;
            }
        }

        return this.#isTLD;
    }

    get tld () {
        if ( this.#tld === undefined ) {
            if ( this.isIP ) {
                this.#tld = null;
            }
            else {
                const idx = this.unicode.lastIndexOf( "." );

                if ( idx < 0 ) this.#tld = this;
                else this.#tld = new this.constructor( this.unicode.substr( idx + 1 ) );
            }
        }

        return this.#tld;
    }

    get tldIsValid () {
        if ( this.#tldIsValid === undefined ) {
            if ( this.isIP ) {
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

            if ( this.isIP ) {
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

                this.#rootLabel = new this.constructor( left.substr( idx + 1 ) );
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
    #checkIsIP () {
        const ip = net.isIP( this.#domain );

        if ( !ip ) {
            this.#isIP = false;
            this.#isIPv4 = false;
            this.#isIPv6 = false;
        }
        else {
            this.#isIP = true;
            this.#isIPv4 = ip === 4;
            this.#isIPv6 = ip === 6;
        }
    }
}
