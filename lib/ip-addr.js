const net = require( "net" );
const fs = require( "./fs" );

const NETWORKS = {};

/** class: Subnet
 * summary: Class represents IP subnetwork.
 */
class Subnet {
    isV4;
    isV6;

    #mask;
    #firstAddr;
    #lastAddr;

    constructor ( cidr ) {
        const addr = cidr.split( "/" );

        this.#firstAddr = new IPAddr( addr[0] );

        this.#mask = addr[1] == null ? 32 : addr[1];

        if ( this.#firstAddr.isV4 ) {
            this.isV4 = true;
        }
        else if ( this.#firstAddr.isV6 ) {
            this.isV6 = true;
        }
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
        if ( !this.#lastAddr ) {
            if ( this.isV4 ) {
                this.#lastAddr = new IPAddr( this.#firstAddr.toNumber() + ( 2 ** ( 32 - this.#mask ) - 1 ) );
            }
            else {

                //
            }
        }

        return this.#lastAddr;
    }

    get mask () {
        return this.#mask;
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
    contains ( ip ) {
        if ( typeof ip !== "object" ) ip = new IPAddr( ip );

        return this.#firstAddr.toNumber() <= ip.toNumber() && ip.toNumber() <= this.lastAddr.toNumber();
    }
}

/** class: IPAddr
 * summary: Represents IP Address.
 */
class IPAddr {
    isV4;
    isV6;

    #toString;
    #toNumber;

    static Subnet = Subnet;

    // TODO v6
    /** method: addSubnet
     * summary: Adds subnet to the subnets range.
     * static: true
     * params:
     *   - name: name
     *     summary: Range name.
     *     required: true
     *     schema:
     *       type: string
     *   - name: cidr
     *     required: true
     *     schema:
     *       type: string
     */
    static addSubnet ( name, cidr ) {
        const network = new Subnet( cidr );

        if ( network.isV6 ) return;

        if ( !NETWORKS[name] ) NETWORKS[name] = [];

        NETWORKS[name].push( network );
    }

    /** method: removeNetwork
     * summary: Removes subnets range.
     * static: true
     * params:
     *   - name: name
     *     required: true
     *     schema:
     *       type: string
     */
    static removeNetwork ( name ) {
        delete NETWORKS[name];
    }

    constructor ( addr ) {
        if ( typeof addr === "string" ) {
            const type = net.isIP( addr );

            if ( !type ) return;

            this.#toString = addr;

            if ( type === 4 ) {
                this.isV4 = true;
            }
            else {
                this.isV6 = true;
            }
        }
        else if ( typeof addr === "number" ) {
            this.isV4 = true;

            this.#toNumber = addr;
        }
    }

    // TODO v6
    toString () {
        if ( !this.#toString ) {
            if ( this.isV4 ) {
                this.#toString = ( this.#toNumber >>> 24 ) + "." + ( ( this.#toNumber >> 16 ) & 255 ) + "." + ( ( this.#toNumber >> 8 ) & 255 ) + "." + ( this.#toNumber & 255 );
            }
            else if ( this.isV6 ) {

                // TODO
            }
        }

        return this.#toString;
    }

    // TODO v6
    toNumber () {
        if ( !this.#toNumber ) {
            if ( this.isV4 ) {
                this.#toNumber =
                    this.#toString.split( "." ).reduce( ( ipInt, octet ) => {
                        return ( ipInt << 8 ) + parseInt( octet, 10 );
                    }, 0 ) >>> 0;
            }
            else if ( this.isV6 ) {

                // TODO
            }
        }

        return this.#toNumber;
    }

    isInNet ( name ) {
        if ( !NETWORKS[name] ) return;

        for ( const subnet of NETWORKS[name] ) {
            if ( subnet.contains( this ) ) return subnet;
        }

        return;
    }

    isInSubnet ( cidr ) {
        if ( typeof cidr !== "object" ) cidr = new Subnet( cidr );

        return cidr.contains( this );
    }
}

module.exports = IPAddr;

const db = fs.config.read( __dirname + "/../resources/subnets.yaml" );

for ( const name in db ) {
    for ( const type in db[name] ) {
        for ( const cidr of db[name][type] ) {
            IPAddr.addSubnet( name, cidr );
        }
    }
}
