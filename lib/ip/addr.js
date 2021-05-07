import ipNum from "ip-num";
import net from "net";
import maxmind from "#lib/maxmind";
import IPRange from "#lib/ip/range";

// XXX
import BigInteger from "big-integer";
import subnets from "../db/subnets.js";
import IPSubnet from "./subnet.js";

export default class IPAddr {
    static new ( addr ) {
        if ( addr instanceof IPAddr ) return addr;

        return new this( addr );
    }

    #isV4;
    #isV6;
    #ipNum;

    #toString;
    #toValue;

    #geo;
    #asn;

    // XXX
    constructor ( addr ) {

        // instance of ipNum
        if ( addr instanceof ipNum.AbstractIPNum ) {
            if ( addr.type === "IPv4" ) this.#isV4 = true;
            else if ( addr.type === "IPv6" ) this.#isV6 = true;
            else throw `Invalid IP address`;

            this.#ipNum = addr;
        }

        // number
        else if ( typeof addr === "number" ) {
            this.#isV4 = true;

            this.#ipNum = new ipNum.IPv4( new BigInteger( addr ) );
        }

        // bigint
        else if ( typeof addr === "bigint" ) {
            this.#isV6 = true;

            this.#ipNum = new ipNum.IPv6( new BigInteger( addr ) );
        }

        // string
        else {
            const type = net.isIP( addr );

            if ( !type ) throw `Invalid IP address`;

            if ( type === 4 ) {
                this.#isV4 = true;

                this.#ipNum = new ipNum.IPv4( addr );
            }
            else {
                this.#isV6 = true;

                this.#ipNum = new ipNum.IPv6( addr );
            }
        }
    }

    get isV4 () {
        return this.#isV4;
    }

    get isV6 () {
        return this.#isV6;
    }

    // XXX remove
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
        if ( this.#toString == null ) this.#toString = this.#ipNum.toString();

        return this.#toString;
    }

    toValue () {
        if ( this.#toValue == null ) {
            if ( this.#isV4 ) this.#toValue = Number( this.#ipNum.getValue().toString() );
            else this.#toValue = BigInt( this.#ipNum.getValue().toString() );
        }

        return this.#toValue;
    }

    inside ( range ) {
        if ( typeof range === "string" ) range = new IPRange( range );

        return range.contains( this );
    }

    // XXX remove
    findSubnet ( name ) {
        return subnets.contains( name, this );
    }

    // XXX remove
    matchSubnet ( subnet ) {
        subnet = IPSubnet.new( subnet );

        return subnet.contains( this );
    }
}
