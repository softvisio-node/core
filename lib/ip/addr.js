import IpRange from "#lib/ip/range";

const PARSING_ERROR_MESSAGE = `IP address is invalid`;
const MAX_IPV4_VALUE = 4294967295;
const MAX_IPV6_VALUE = 340282366920938463463374607431768211455n;

export default class IpAddr {
    #isV4;
    #value;
    #string;
    #fullString;
    #previousAddr;
    #nextAddr;

    constructor ( addr ) {
        if ( addr instanceof IpAddr ) {
            this.#isV4 = addr.isV4;
            this.#value = addr.value;
        }

        // ipv4 number
        else if ( typeof addr === "number" ) {

            // check range
            if ( addr < 0 || addr > MAX_IPV4_VALUE ) throw Error( PARSING_ERROR_MESSAGE );

            this.#isV4 = true;
            this.#value = addr;
        }

        // ipv6 number
        else if ( typeof addr === "bigint" ) {

            // check range
            if ( addr < 0n || addr > MAX_IPV6_VALUE ) throw Error( PARSING_ERROR_MESSAGE );

            this.#isV4 = false;
            this.#value = addr;
        }

        // string
        else if ( typeof addr === "string" ) {

            // ipv6 string
            if ( addr.includes( ":" ) ) {
                this.#parseV6( addr );
            }

            // ipv4 string
            else if ( addr.includes( "." ) ) {
                this.#parseV4( addr );
            }
            else {
                throw Error( `IP address is invalid` );
            }
        }
        else {
            throw Error( `IP address is invalid` );
        }
    }

    // static
    static new ( addr ) {
        if ( addr instanceof IpAddr ) return addr;

        return new this( addr );
    }

    // properties
    get value () {
        return this.#value;
    }

    get isV4 () {
        return this.#isV4;
    }

    get isV6 () {
        return !this.#isV4;
    }

    // public
    toString () {
        if ( !this.#string ) {
            if ( this.#isV4 ) {
                const buf = Buffer.allocUnsafe( 4 );

                buf.writeUInt32BE( this.#value );

                this.#string = buf.join( "." );
                this.#fullString = this.#string;
            }
            else {
                if ( this.#value === 0n ) {
                    this.#string = "::";
                    this.#fullString = "0000:0000:0000:0000:0000:0000:0000:0000";
                }
                else {
                    const str = this.#value.toString( 16 ).padStart( 32, "0" ),
                        hextets = new Array( 8 ),
                        fullHextets = new Array( 8 );

                    let zero, longestZero;

                    for ( let n = 0; n < 8; n++ ) {
                        fullHextets[n] = str.substr( n * 4, 4 );

                        const hextet = Number( "0x" + fullHextets[n] ).toString( 16 );

                        hextets[n] = hextet;

                        // zero segment start
                        if ( hextet === "0" && !zero ) zero = [n, null, null];

                        // zero segment end
                        if ( zero && ( hextet !== "0" || n === 7 ) ) {
                            zero[1] = hextet !== "0" ? n - 1 : n;

                            zero[2] = zero[1] - zero[0] + 1;

                            if ( !longestZero || zero[2] > longestZero[2] ) longestZero = zero;

                            zero = null;
                        }
                    }

                    if ( longestZero ) {
                        hextets.splice( longestZero[0], longestZero[2], longestZero[0] === 0 || longestZero[1] === 7 ? ":" : "" );
                    }

                    this.#string = hextets.join( ":" );
                    this.#fullString = fullHextets.join( ":" );
                }
            }
        }

        return this.#string;
    }

    toFullString () {
        if ( !this.#fullString ) this.toString();

        return this.#fullString;
    }

    toJSON () {
        return this.toString();
    }

    hasPreviousAddr () {
        if ( this.#isV4 ) {
            return this.#value > 0;
        }
        else {
            return this.#value > 0n;
        }
    }

    hasNextAddr () {
        if ( this.#isV4 ) {
            return this.#value < MAX_IPV4_VALUE;
        }
        else {
            return this.#value < MAX_IPV6_VALUE;
        }
    }

    getPreviousAddr () {
        if ( !this.hasPreviousAddr() ) return;

        if ( !this.#previousAddr ) {
            if ( this.#isV4 ) this.#previousAddr = new this.constructor( this.#value - 1 );
            else this.#previousAddr = new this.constructor( this.#value - 1n );
        }

        return this.#previousAddr;
    }

    getNextAddr () {
        if ( !this.hasNextAddr() ) return;

        if ( !this.#nextAddr ) {
            if ( this.#isV4 ) this.#nextAddr = new this.constructor( this.#value + 1 );
            else this.#nextAddr = new this.constructor( this.#value + 1n );
        }

        return this.#nextAddr;
    }

    inside ( range ) {
        if ( typeof range === "string" ) range = new IpRange( range );

        return range.contains( this );
    }

    // private
    #parseV4 ( addr ) {
        const hextets = addr.split( "." );

        if ( hextets.length !== 4 ) throw Error( PARSING_ERROR_MESSAGE );

        for ( let n = 0; n < hextets.length; n++ ) {
            const number = +hextets[n];

            if ( isNaN( number ) || number < 0 || number > 255 ) throw Error( PARSING_ERROR_MESSAGE );

            hextets[n] = number;
        }

        this.#isV4 = true;
        this.#value = hextets[0] * 16777216 + hextets[1] * 65536 + hextets[2] * 256 + hextets[3];
    }

    #parseV6 ( addr ) {
        var hextets;

        const groups = addr.split( "::" );

        if ( groups.length > 2 ) throw Error( PARSING_ERROR_MESSAGE );

        if ( groups.length === 2 ) {
            hextets = groups[0] ? this.#parseHextets( groups[0] ) : "";
            if ( groups[1] ) groups[1] = this.#parseHextets( groups[1] );

            // handle 1:2:3:4:5:6:7::1
            if ( hextets.length + groups[1].length >= 32 ) throw Error( PARSING_ERROR_MESSAGE );

            hextets += groups[1].padStart( 32 - hextets.length, "0" );
        }
        else {
            hextets = this.#parseHextets( groups[0] );
        }

        if ( hextets.length !== 32 ) throw Error( PARSING_ERROR_MESSAGE );

        try {
            this.#value = BigInt( "0x" + hextets );
            this.#isV4 = false;
        }
        catch ( e ) {
            throw Error( PARSING_ERROR_MESSAGE );
        }
    }

    #parseHextets ( hextets ) {
        return hextets
            .split( ":" )
            .map( hextet => {
                if ( hextet.length === 0 || hextet.length > 4 ) throw Error( PARSING_ERROR_MESSAGE );
                else return hextet.padStart( 4, "0" );
            } )
            .join( "" );
    }
}
