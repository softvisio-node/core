import IPAddr from "./addr.js";
import IPNum from "ip-num";
import BigInteger from "big-integer";

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
    #ipNum;

    #isCidrAble;
    #cidrRange;
    #size;

    #firstAddr;
    #lastAddr;

    constructor ( range ) {
        if ( range instanceof IPRange ) range = range.toString();

        if ( range instanceof IPAddr ) {
            if ( range.isV4 ) this.#isV4 = true;
            else this.#isV6 = true;

            this.#isCidrAble = true;

            this.#ipNum = IPNum.RangedSet.fromSingleIP( range.ipNum );
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

                    range = new IPNum.IPv4CidrRange( new IPNum.IPv4( ip ), new IPNum.IPv4Prefix( prefix ) );
                }

                // ipV6
                else {
                    this.#isV6 = true;

                    range = new IPNum.IPv6CidrRange( new IPNum.IPv6( ip ), new IPNum.IPv6Prefix( prefix ) );
                }

                range = IPNum.RangedSet.fromCidrRange( range );
            }

            // range string
            else if ( range.includes( "-" ) ) {
                if ( range.includes( "." ) ) this.#isV4 = true;
                else this.#isV6 = true;

                range = IPNum.RangedSet.fromRangeString( range );
            }

            // single ip address
            else {
                const ip = IPAddr.new( range );

                if ( ip.isV4 ) this.#isV4 = true;
                else this.#isV6 = true;

                this.#isCidrAble = true;

                range = IPNum.RangedSet.fromSingleIP( ip.ipNum );
            }

            this.#ipNum = range;
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

    // XXX
    get prefix () {
        return this.#ipNum.cidrPrefix;
    }

    get isCidrAble () {
        if ( this.#isCidrAble == null ) {
            this.#isCidrAble = this.#ipNum.isCidrAble();
        }

        return this.#isCidrAble;
    }

    get cidrRange () {
        if ( this.#cidrRange == null ) {
            this.#cidrRange = this.#ipNum.toCidrRange();
        }

        return this.#cidrRange;
    }

    get size () {
        if ( !this.#size ) {
            this.#size = this.#ipNum.getSize();

            if ( this.isV4 ) this.#size = +this.#size;
            else this.#size = BigInt( this.#size.toString() );
        }

        return this.#size;
    }

    /** property: firstAddr
     * summary: Returns first IP address of subnetwork range.
     */
    get firstAddr () {
        if ( !this.#firstAddr ) this.#firstAddr = new IPAddr( this.#ipNum.getFirst() );

        return this.#firstAddr;
    }

    /** property: lastAddr
     * summary: Returns last IP address of subnetwork range.
     */
    get lastAddr () {
        if ( !this.#lastAddr ) this.#lastAddr = new IPAddr( this.#ipNum.getLast() );

        return this.#lastAddr;
    }

    toString () {
        if ( this.isCidrAble ) return this.cidrRange.toCidrString();
        else return this.#ipNum.toRangeString();
    }

    toCidrString () {
        return this.cidrRange.toCidrString();
    }

    toRangeString () {
        return this.#ipNum.toRangeString();
    }

    // XXX
    getRandomAddr () {
        const num = BigInteger.randBetween( this.firstAddr.ipNum.getValue(), this.lastAddr.ipNum.getValue() );

        if ( this.#isV4 ) {
            return new IPAddr( new IPNum.IPv4( num ) );
        }
        else {
            return new IPAddr( new IPNum.IPv6( num ) );
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
}
