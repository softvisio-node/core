const net = require( "net" );
const { OBJECT_IS_IP_ADDR } = require( "./const" );
const { objectIsSubnet } = require( "./util" );

var Subnet;
var subnets;
var MAXMIND;

/** class: IPAddr
 * summary: Represents IP Address.
 */
class IPAddr {
    static [OBJECT_IS_IP_ADDR] = true;

    #isV4;
    #isV6;

    #toString;
    #toNumber;
    #geo;
    #asn;

    // XXX v6 detect
    constructor ( addr ) {
        if ( typeof addr === "string" ) {
            const type = net.isIP( addr );

            if ( !type ) return;

            this.#toString = addr;

            if ( type === 4 ) {
                this.#isV4 = true;
            }
            else {
                this.#isV6 = true;
            }
        }

        // XXX
        else if ( typeof addr === "number" ) {
            this.#isV4 = true;

            this.#toNumber = addr;
        }
    }

    get isV4 () {
        return this.#isV4;
    }

    get isV6 () {
        return this.#isV6;
    }

    // MAXMIND
    get asn () {
        if ( !this.#asn ) {
            if ( !MAXMIND ) MAXMIND = require( "@softvisio/maxmind" );

            this.#asn = MAXMIND.asn.get( this.#toString );
        }

        return this.#asn;
    }

    get geo () {
        if ( !this.#geo ) {
            if ( !MAXMIND ) MAXMIND = require( "@softvisio/maxmind" );

            this.#geo = MAXMIND.city.get( this.#toString );
        }

        return this.#geo;
    }

    // TODO v6
    toString () {
        if ( !this.#toString ) {
            if ( this.#isV4 ) {
                this.#toString = ( this.#toNumber >>> 24 ) + "." + ( ( this.#toNumber >> 16 ) & 255 ) + "." + ( ( this.#toNumber >> 8 ) & 255 ) + "." + ( this.#toNumber & 255 );
            }
            else if ( this.#isV6 ) {

                // TODO
            }
        }

        return this.#toString;
    }

    // TODO v6
    toNumber () {
        if ( !this.#toNumber ) {
            if ( this.#isV4 ) {
                this.#toNumber =
                    this.#toString.split( "." ).reduce( ( ipInt, octet ) => {
                        return ( ipInt << 8 ) + parseInt( octet, 10 );
                    }, 0 ) >>> 0;
            }
            else if ( this.#isV6 ) {

                // TODO
            }
        }

        return this.#toNumber;
    }

    findSubnet ( name ) {
        if ( !subnets ) subnets = require( "./db/subnets" );

        return subnets.contains( name, this );
    }

    matchSubnet ( subnet ) {
        if ( !objectIsSubnet( subnet ) ) {
            if ( !Subnet ) Subnet = require( "./ip-addr/subnet" );

            subnet = new Subnet( subnet );
        }

        return subnet.contains( this );
    }
}

module.exports = IPAddr;
