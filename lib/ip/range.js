import ipNum from "ip-num";
import IPAddr from "./addr.js";
import { randomBigInt } from "#lib/utils";

/** class: IPRange
 * summary: Represents IP Addresses range.
 */
export default class IPRange {
    static new ( range, prefix ) {
        if ( range instanceof IPRange ) return range;

        return new this( range, prefix );
    }

    #isV4;
    #isV6;

    #_ipNumRangedSet;
    #_ipNumCidrRange;

    #isCidrAble;
    #cidrRange;
    #size;
    #prefix;
    #toString;
    #toCidrString;
    #toRangeString;

    #firstAddr;
    #lastAddr;

    constructor ( range ) {
        if ( range instanceof IPRange ) range = range.toString();

        if ( range instanceof IPAddr ) {
            if ( range.isV4 ) this.#isV4 = true;
            else this.#isV6 = true;

            this.#isCidrAble = true;

            this.#_ipNumRangedSet = ipNum.RangedSet.fromSingleIP( range.ipNum );
        }

        // string
        else {
            const idx = range.indexOf( "/" );

            // cidr notation
            if ( idx > 0 ) {
                this.#isCidrAble = true;

                const ip = range.substring( 0, idx );
                const prefix = range.substr( idx + 1 );

                // ipV4
                if ( ip.includes( "." ) ) {
                    this.#isV4 = true;

                    range = new ipNum.IPv4CidrRange( new ipNum.IPv4( ip ), new ipNum.IPv4Prefix( prefix ) );
                }

                // ipV6
                else {
                    this.#isV6 = true;

                    range = new ipNum.IPv6CidrRange( new ipNum.IPv6( ip ), new ipNum.IPv6Prefix( prefix ) );
                }

                range = ipNum.RangedSet.fromCidrRange( range );
            }

            // range string
            else if ( range.includes( "-" ) ) {
                if ( range.includes( "." ) ) this.#isV4 = true;
                else this.#isV6 = true;

                range = ipNum.RangedSet.fromRangeString( range );
            }

            // single ip address
            else {
                const ip = IPAddr.new( range );

                if ( ip.isV4 ) this.#isV4 = true;
                else this.#isV6 = true;

                this.#isCidrAble = true;

                range = ipNum.RangedSet.fromSingleIP( ip.ipNum );
            }

            this.#_ipNumRangedSet = range;
        }
    }

    get isV4 () {
        return this.#isV4;
    }

    get isV6 () {
        return this.#isV6;
    }

    get prefix () {
        if ( !this.#prefix ) this.#prefix = this.#ipNumCidrRange.cidrPrefix;

        return this.#prefix;
    }

    get isCidrAble () {
        if ( this.#isCidrAble == null ) {
            if ( this.#_ipNumCidrRange ) this.#isCidrAble = true;
            else this.#isCidrAble = this.#_ipNumRangedSet.isCidrAble();
        }

        return this.#isCidrAble;
    }

    get size () {
        if ( this.#size == null ) {
            this.#size = this.#ipNumRangedSet.getSize();

            if ( this.isV4 ) this.#size = +this.#size;
            else this.#size = BigInt( this.#size.toString() );
        }

        return this.#size;
    }

    /** property: firstAddr
     * summary: Returns first IP address of subnetwork range.
     */
    get firstAddr () {
        if ( !this.#firstAddr ) this.#firstAddr = new IPAddr( this.#ipNumRangedSet.getFirst() );

        return this.#firstAddr;
    }

    /** property: lastAddr
     * summary: Returns last IP address of subnetwork range.
     */
    get lastAddr () {
        if ( !this.#lastAddr ) this.#lastAddr = new IPAddr( this.#ipNumRangedSet.getLast() );

        return this.#lastAddr;
    }

    toString () {
        if ( this.#toString == null ) {
            if ( this.isCidrAble ) this.#toString = this.toCidrString();
            else this.#toString = this.toRangeString();
        }

        return this.#toString;
    }

    toCidrString () {
        if ( this.#toCidrString == null ) this.#toCidrString = this.#ipNumCidrRange.toCidrString();

        return this.#toCidrString;
    }

    toRangeString () {
        if ( this.#toRangeString == null ) this.#toRangeString = this.#ipNumRangedSet.toRangeString();

        return this.#toRangeString;
    }

    getRandomAddr () {
        var min = this.firstAddr.ipNum.getValue(),
            max = this.lastAddr.ipNum.getValue();

        if ( this.#isV4 ) {
            min = Number( min.toString() );
            max = Number( max.toString() ) - min + 1;

            return new IPAddr( min + Math.floor( Math.random() * max ) );
        }
        else {
            return new IPAddr( randomBigInt( BigInt( min.toString() ), BigInt( max.toString() ) ) );
        }
    }

    // XXX
    /** method: contains
     * summary: Check that IP address is belongs to this subnetwork.
     * params:
     *   - name: ipAddr
     *     summary: IP address as IPAddr object or string.
     *     schema:
     *       type:
     *         - string
     *         - object
     */
    contains ( addr ) {
        addr = IPAddr.new( addr );

        if ( addr.isV4 !== this.#firstAddr.isV4 ) return false;

        return addr.ipNum.isGreaterThanOrEquals( this.firstAddr.ipNum ) && addr.ipNum.isLessThanOrEquals( this.lastAddr.ipNum );
    }

    // XXX
    inside () {}

    // private
    get #ipNumRangedSet () {
        if ( !this.#_ipNumRangedSet ) this.#_ipNumRangedSet = this.#_ipNumCidrRange.toRangedSet();

        return this.#_ipNumRangedSet;
    }

    get #ipNumCidrRange () {
        if ( !this.#_ipNumCidrRange ) this.#_ipNumCidrRange = this.#_ipNumRangedSet.toCidrRange();

        return this.#_ipNumCidrRange;
    }
}
