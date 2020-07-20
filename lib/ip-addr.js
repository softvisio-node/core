const net = require( "net" );
const fs = require( "./fs" );

const NETWORKS = {};

/** class Subnet
 * summary: Class represents IP subnetwork.
 */
class Subnet {
    isV4;
    isV6;

    #mask;
    #firstIP;
    #lastIP;

    constructor ( cidr ) {
        const addr = cidr.split( "/" );

        this.#firstIP = new IPAddr( addr[0] );
        this.#mask = addr[1];

        if ( this.#firstIP.isV4 ) {
            this.isV4 = true;
        }
        else if ( this.#firstIP.isV6 ) {
            this.isV6 = true;
        }
    }

    /** method: getFirstIP
     * summary: Returns first IP address of subnetwork range.
     */
    getFirstIP () {
        return this.#firstIP;
    }

    /** method: getLastIP
     * summary: Returns last IP address of subnetwork range.
     */
    getLastIP () {
        if ( !this.#lastIP ) {
            if ( this.isV4 ) {
                this.#lastIP = new IPAddr( this.#firstIP.toNumber() + ( 2 ** ( 32 - this.#mask ) - 1 ) );
            }
            else {

                //
            }
        }

        return this.#lastIP;
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

        return this.#firstIP.toNumber() <= ip.toNumber() && ip.toNumber() <= this.getLastIP().toNumber();
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

    /** method: newSubnet
     * summary: Returns new Subnet object.
     * static: true
     * params:
     *   - name: cidr
     *     required: true
     *     schema:
     *       type: sting
     */
    static newSubnet ( cidr ) {
        return new Subnet( cidr );
    }

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
        const network = this.newSubnet( cidr );

        if ( network.isV6 ) return;

        if ( !NETWORKS[name] ) NETWORKS[name] = [];

        NETWORKS[name].push( network );
    }

    /** method: removeNetworks
     * summary: Removes subnets range.
     * static: true
     * params:
     *   - name: name
     *     required: true
     *     schema:
     *       type: string
     */
    static removeNetworks ( name ) {
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

        for ( const network of NETWORKS[name] ) {
            if ( network.contains( this ) ) return network;
        }

        return;
    }

    isInSubnet ( cidr ) {
        if ( typeof cidr !== "object" ) cidr = this.constructor.newSubnet( cidr );

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
