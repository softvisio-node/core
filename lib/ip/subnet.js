const IPAddr = require( "./addr" );
const IPNum = require( "ip-num" );
const BigInteger = require( "big-integer" );
const { objectIsIpAddr } = require( "../util" );
const { OBJECT_IS_SUBNET } = require( "../const" );

/** class: Subnet
 * summary: Represents IP Address subnet.
 */
class Subnet {
    static [OBJECT_IS_SUBNET] = true;

    #isV4;
    #isV6;

    #range;
    #mask;
    #firstAddr;
    #lastAddr;

    constructor ( cidr ) {
        const addr = cidr.split( "/" );

        this.#firstAddr = new IPAddr( addr[0] );

        if ( this.#firstAddr.isV4 ) {
            this.#isV4 = true;

            if ( addr[1] == null ) addr[1] = 32;

            this.#mask = addr[1];

            this.#range = IPNum.IPv4CidrRange.fromCidr( addr.join( "/" ) );
        }
        else if ( this.#firstAddr.isV6 ) {
            this.#isV6 = true;

            if ( addr[1] == null ) addr[1] = 128;

            this.#mask = addr[1];

            this.#range = IPNum.IPv6CidrRange.fromCidr( addr.join( "/" ) );
        }
    }

    get isV4 () {
        return this.#isV4;
    }

    get isV6 () {
        return this.#isV6;
    }

    get range () {
        return this.#range;
    }

    get mask () {
        return this.#mask;
    }

    /** property: firstAddr
     * summary: Returns first IP address of subnetwork range.
     */
    get firstAddr () {
        return this.#firstAddr;
    }

    /** property: lastAddr
     * summary: Returns last IP address of subnetwork range.
     */
    get lastAddr () {
        if ( !this.#lastAddr ) this.#lastAddr = new IPAddr( this.#range.getLast().toString() );

        return this.#lastAddr;
    }

    get randomAddr () {
        const num = BigInteger.randBetween( this.firstAddr.ipNum.getValue(), this.lastAddr.ipNum.getValue() );

        if ( this.#isV4 ) {
            return new IPAddr( new IPNum.IPv4( num ).toString() );
        }
        else {
            return new IPAddr( new IPNum.IPv6( num ).toString() );
        }
    }

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

    // XXX
    contains ( addr ) {
        if ( !objectIsIpAddr( addr ) ) addr = new IPAddr( addr );

        return this.#firstAddr.toNumber() <= addr.toNumber() && addr.toNumber() <= this.lastAddr.toNumber();
    }
}

module.exports = Subnet;
