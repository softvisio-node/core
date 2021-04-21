const net = require( "net" );
const IPNum = require( "ip-num" );
const maxmind = require( "../maxmind" );
const BigInteger = require( "big-integer" );

var IPSubnet;
var subnets;

module.exports = class IPAddr {
    static new ( addr ) {
        if ( addr instanceof IPAddr ) return addr;

        return new this( addr );
    }

    #isV4;
    #isV6;
    #ipNum;

    #geo;
    #asn;

    constructor ( addr ) {

        // instance of IPNum
        if ( addr instanceof IPNum.AbstractIPNum ) {
            if ( addr.type === "IPv4" ) this.#isV4 = true;
            else if ( addr.type === "IPv6" ) this.#isV6 = true;
            else throw `Invalid IP address`;

            this.#ipNum = addr;
        }

        // number
        else if ( typeof addr === "number" ) {
            this.#isV4 = true;

            this.#ipNum = new IPNum.IPv4( new BigInteger( addr ) );
        }

        // bigint
        else if ( typeof addr === "bigint" ) {
            this.#isV6 = true;

            this.#ipNum = new IPNum.IPv6( new BigInteger( addr ) );
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
            this.#asn = maxmind.asn.get( this.toString() );
        }

        return this.#asn;
    }

    get geo () {
        if ( !this.#geo ) {
            this.#geo = maxmind.city.get( this.toString() );
        }

        return this.#geo;
    }

    get country () {
        const geo = this.geo;

        return geo ? geo.country.iso_code : null;
    }

    get timezone () {
        const geo = this.geo;

        return geo ? geo.location.time_zone : null;
    }

    toString () {
        return this.#ipNum.toString();
    }

    findSubnet ( name ) {
        if ( !subnets ) subnets = require( "../db/subnets" );

        return subnets.contains( name, this );
    }

    matchSubnet ( subnet ) {
        if ( !IPSubnet ) IPSubnet = require( "./subnet" );

        subnet = IPSubnet.new( subnet );

        return subnet.contains( this );
    }
};
