const { objectIsIpAddr } = require( "../util" );
const { OBJECT_IS_SUBNET } = require( "../const" );
const IPAddr = require( "../ip-addr" );

/** class: Subnet
 * summary: Represents IP Address subnet.
 */
class Subnet {
    static [OBJECT_IS_SUBNET] = true;

    #isV4;
    #isV6;

    #mask;
    #firstAddr;
    #lastAddr;

    constructor ( cidr ) {
        const addr = cidr.split( "/" );

        this.#firstAddr = new IPAddr( addr[0] );

        if ( this.#firstAddr.isV4 ) {
            this.#isV4 = true;

            this.#mask = addr[1] == null ? 32 : addr[1];
        }
        else if ( this.#firstAddr.isV6 ) {
            this.#isV6 = true;

            this.#mask = addr[1] == null ? 128 : addr[1];
        }
    }

    get isV4 () {
        return this.#isV4;
    }

    get isV6 () {
        return this.#isV6;
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
    // XXX v6
    get lastAddr () {
        if ( !this.#lastAddr ) {
            if ( this.#isV4 ) {
                this.#lastAddr = new IPAddr( this.#firstAddr.toNumber() + ( 2 ** ( 32 - this.#mask ) - 1 ) );
            }
            else {

                // XXX
            }
        }

        return this.#lastAddr;
    }

    // XXX
    get randomAddr () {
        if ( this.#isV4 ) {
            return null;
        }
        else {
            return null;
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

        return this.#firstAddr.toNumber() <= addr.toNumber() && addr.toNumber() <= this.lastAddr.toNumber();
    }
}

module.exports = Subnet;
