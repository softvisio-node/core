const net = require( "net" );
const IPNum = require( "ip-num" );
const { OBJECT_IS_IP_ADDR } = require( "../const" );
const { objectIsSubnet } = require( "../util" );

var Subnet;
var subnets;
var MAXMIND;

class IPAddr {
    static [OBJECT_IS_IP_ADDR] = true;

    #isV4;
    #isV6;
    #ipNum;

    #geo;
    #asn;

    constructor ( addr ) {
        const type = net.isIP( addr );

        if ( !type ) throw `Invalid IP address`;

        if ( type === 4 ) {
            this.#isV4 = true;
            this.#ipNum = new IPNum.IPv4( addr );
        }
        else {
            this.#isV6 = true;
            this.#ipNum = new IPNum.IPv6( addr );
        }
    }

    get isV4 () {
        return this.#isV4;
    }

    get isV6 () {
        return this.#isV6;
    }

    get ipNum () {
        return this.#ipNum;
    }

    // MAXMIND
    get asn () {
        if ( !this.#asn ) {
            if ( !MAXMIND ) MAXMIND = require( "@softvisio/maxmind" );

            this.#asn = MAXMIND.asn.get( this.toString() );
        }

        return this.#asn;
    }

    get geo () {
        if ( !this.#geo ) {
            if ( !MAXMIND ) MAXMIND = require( "@softvisio/maxmind" );

            this.#geo = MAXMIND.city.get( this.toString() );
        }

        return this.#geo;
    }

    toString () {
        return this.#ipNum.toString();
    }

    toNumber () {
        return this.#ipNum.getValue();
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
