const net = require( "net" );
const IPNum = require( "ip-num" );

var Subnet;
var subnets;
var MAXMIND;

class IPAddr {
    #isV4;
    #isV6;
    #ipNum;

    #geo;
    #asn;

    constructor ( addr ) {

        // instance of IPNum
        if ( addr instanceof IPNum.AbstractIPNum ) {
            if ( addr.type === IPNum.IPNumType["IPv4"] ) this.#isV4 = true;
            else if ( addr.type === IPNum.IPNumType["IPv6"] ) this.#isV6 = true;
            else throw `Invalid IP address`;

            this.#ipNum = addr;
        }

        // string
        else {
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

    findSubnet ( name ) {
        if ( !subnets ) subnets = require( "../db/subnets" );

        return subnets.contains( name, this );
    }

    matchSubnet ( subnet ) {
        if ( !Subnet ) Subnet = require( "./subnet" );

        if ( !( subnet instanceof Subnet ) ) subnet = new Subnet( subnet );

        return subnet.contains( this );
    }
}

module.exports = IPAddr;
