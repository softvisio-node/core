const IPAddr = require( "./addr" );
const IPNum = require( "ip-num" );
const BigInteger = require( "big-integer" );
const { objectIsIpAddr } = require( "../util" );
const { OBJECT_IS_SUBNET } = require( "../const" );

/** class: Subnet
 * summary: Represents IP Address subnet.
 */
class IPSubnet {
    static [OBJECT_IS_SUBNET] = true;

    #isV4;
    #isV6;
    #ipNum;

    #firstAddr;
    #lastAddr;

    constructor ( cidr, prefix ) {
        if ( cidr instanceof IPNum.IPv4CidrRange ) {
            this.#isV4 = true;

            if ( prefix != null ) {
                if ( !( prefix instanceof IPNum.IPv4Prefix ) ) prefix = new IPNum.IPv4Prefix( prefix );

                this.#ipNum = new IPNum.IPv4CidrRange( cidr.getFirst(), prefix );
            }
            else {
                this.#ipNum = cidr;
            }
        }
        else if ( cidr instanceof IPNum.IPv6CidrRange ) {
            this.#isV6 = true;

            if ( prefix != null ) {
                if ( !( prefix instanceof IPNum.IPv6Prefix ) ) prefix = new IPNum.IPv6Prefix( prefix );

                this.#ipNum = new IPNum.IPv6CidrRange( cidr.getFirst(), prefix );
            }
            else {
                this.#ipNum = cidr;
            }
        }

        // string
        else {
            const addr = cidr.split( "/" );

            this.#firstAddr = new IPAddr( addr[0] );

            if ( this.#firstAddr.isV4 ) {
                this.#isV4 = true;

                if ( prefix == null ) prefix = addr[1] || 32;
                if ( !( prefix instanceof IPNum.IPv4Prefix ) ) prefix = new IPNum.IPv4Prefix( prefix );

                this.#ipNum = new IPNum.IPv4CidrRange( this.#firstAddr.ipNum, prefix );
            }
            else if ( this.#firstAddr.isV6 ) {
                this.#isV6 = true;

                if ( prefix == null ) prefix = addr[1] || 128;
                if ( !( prefix instanceof IPNum.IPv6Prefix ) ) prefix = new IPNum.IPv6Prefix( prefix );

                this.#ipNum = new IPNum.IPv6CidrRange( this.#firstAddr.ipNum, prefix );
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

    get prefix () {
        return this.#ipNum.cidrPrefix;
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
        return this.#ipNum.toCidrString();
    }

    getRandomAddr () {
        const num = BigInteger.randBetween( this.firstAddr.ipNum.getValue(), this.lastAddr.ipNum.getValue() );

        if ( this.#isV4 ) {
            return new IPAddr( new IPNum.IPv4( num ) );
        }
        else {
            return new IPAddr( new IPNum.IPv6( num ) );
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
    contains ( addr ) {
        if ( !objectIsIpAddr( addr ) ) addr = new IPAddr( addr );

        if ( addr.isV4 !== this.#firstAddr.isV4 ) return false;

        return addr.ipNum.isGreaterThanOrEquals( this.#firstAddr.ipNum ) && addr.ipNum.isLessThanOrEquals( this.#lastAddr.ipNum );
    }
}

module.exports = IPSubnet;
