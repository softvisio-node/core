import ipNum from "ip-num";
import IPRange from "#lib/ip/range";
import BigInteger from "big-integer";
import maxmind from "#lib/maxmind";

export default class IPAddr {
    static new ( addr ) {
        if ( addr instanceof IPAddr ) return addr;

        return new this( addr );
    }

    #isV4;
    #isV6;
    #ipNum;

    #toString;
    #value;

    #geo;
    #asn;

    constructor ( addr ) {
        if ( addr instanceof ipNum.IPv4 ) {
            this.#isV4 = true;

            this.#ipNum = addr;
        }
        else if ( addr instanceof ipNum.IPv6 ) {
            this.#isV6 = true;

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
            if ( addr.includes( "." ) ) {
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

    get value () {
        if ( this.#value == null ) {
            if ( this.isV4 ) this.#value = Number( this.#ipNum.getValue().toString() );
            else this.#value = BigInt( this.#ipNum.getValue().toString() );
        }

        return this.#value;
    }

    // public
    toString () {
        if ( this.#toString == null ) this.#toString = this.#ipNum.toString();

        return this.#toString;
    }

    inside ( range ) {
        if ( typeof range === "string" ) range = new IPRange( range );

        return range.contains( this );
    }

    getNextAddr () {
        if ( !this.#ipNum.hasNext() ) return;

        return new IPAddr( this.value + ( this.isV4 ? 1 : 1n ) );
    }

    getPreviousAddr () {
        if ( !this.#ipNum.hasPrevious() ) return;

        return new IPAddr( this.value - ( this.isV4 ? 1 : 1n ) );
    }

    // maxmind
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
}
