import IPAddr from "#lib/ip/addr";
import { getRandomBigInt } from "#lib/utils";

const PARSING_ERROR_MESSAGE = `IP range is invalid`;

const V4_MASK0 = new Array( 32 );
const V4_MASK1 = new Array( 32 );
const V6_MASK0 = new Array( 128 );
const V6_MASK1 = new Array( 128 );

export default class IPRange {
    #firstAddr;
    #lastAddr;
    #prefix;
    #string;
    #rangeString;
    #cidrString;

    constructor ( range ) {
        if ( range instanceof IPRange ) {
            this.#firstAddr = range.firstAddr;
            this.#lastAddr = range.lastAddr;
        }
        else if ( range instanceof IPAddr ) {
            this.#firstAddr = range;
            this.#lastAddr = range;
        }
        else if ( typeof range === "string" ) {
            let idx = range.indexOf( "/" );

            // cidr notation
            if ( idx > 0 ) {
                const prefix = +range.substr( idx + 1 );

                if ( isNaN( prefix ) || prefix < 0 || prefix > 128 ) throw Error( PARSING_ERROR_MESSAGE );

                const addr = new IPAddr( range.substring( 0, idx ) );

                // v4
                if ( addr.isV4 ) {
                    if ( prefix > 32 ) throw Error( PARSING_ERROR_MESSAGE );

                    V4_MASK0[prefix] ??= Number( "0b" + "1".repeat( prefix ) + "0".repeat( 32 - prefix ) );
                    this.#firstAddr = new IPAddr( ( addr.value & V4_MASK0[prefix] ) >>> 0 );

                    V4_MASK1[prefix] ??= Number( "0b" + "0".repeat( prefix ) + "1".repeat( 32 - prefix ) );
                    this.#lastAddr = new IPAddr( ( addr.value | V4_MASK1[prefix] ) >>> 0 );
                }

                // v6
                else {
                    V6_MASK0[prefix] ??= BigInt( "0b" + "1".repeat( prefix ) + "0".repeat( 128 - prefix ) );
                    this.#firstAddr = new IPAddr( addr.value & V6_MASK0[prefix] );

                    V6_MASK1[prefix] ??= BigInt( "0b" + "0".repeat( prefix ) + "1".repeat( 128 - prefix ) );
                    this.#lastAddr = new IPAddr( addr.value | V6_MASK1[prefix] );
                }

                this.#prefix = prefix;
            }
            else {
                idx = range.indexOf( "-" );

                // range string
                if ( idx > 0 ) {
                    this.#firstAddr = new IPAddr( range.substring( 0, idx ) );
                    this.#lastAddr = new IPAddr( range.substr( idx + 1 ) );

                    if ( this.#firstAddr.isV4 && !this.#lastAddr.isV4 ) throw Error( PARSING_ERROR_MESSAGE );

                    // swap first <-> last
                    if ( this.#firstAddr.value > this.#lastAddr.value ) [this.#firstAddr, this.#lastAddr] = [this.#lastAddr, this.#firstAddr];
                }

                // single ip address
                else {
                    this.#firstAddr = new IPAddr( range );
                    this.#lastAddr = this.#firstAddr;
                }
            }
        }

        // invalid type
        else {
            throw Error( PARSING_ERROR_MESSAGE );
        }
    }

    // static
    static new ( range ) {
        if ( range instanceof IPRange ) return range;

        return new this( range );
    }

    // properties
    get isV4 () {
        return this.#firstAddr.isV4;
    }

    get isV6 () {
        return this.#firstAddr.isV6;
    }

    get firstAddr () {
        return this.#firstAddr;
    }

    get lastAddr () {
        return this.#lastAddr;
    }

    get size () {
        if ( this.isV4 ) {
            return this.#lastAddr.value - this.#firstAddr.value + 1;
        }
        else {
            return this.#lastAddr.value - this.#firstAddr.value + 1n;
        }
    }

    get isCIDRAble () {
        return this.prefix === null;
    }

    get prefix () {
        if ( this.#prefix === undefined ) {
            const isV4 = this.#firstAddr.isV4;

            if ( this.#firstAddr.value === this.#lastAddr.value ) {
                this.#prefix = isV4 ? 32 : 128;
            }
            else {
                let first = this.#firstAddr.value.toString( 2 ),
                    last = this.#lastAddr.value.toString( 2 );

                if ( isV4 ) {
                    first = first.padStart( 32, "0" );
                    last = last.padStart( 32, "0" );
                }
                else {
                    first = first.padStart( 128, "0" );
                    last = last.padStart( 128, "0" );
                }

                let prefix;

                for ( prefix = 0; prefix < first.length; prefix++ ) {
                    if ( first[prefix] !== last[prefix] ) break;
                }

                for ( let n = prefix; n < first.length; n++ ) {
                    if ( first[n] !== "0" || last[n] !== "1" ) {
                        prefix = null;

                        break;
                    }
                }

                this.#prefix = prefix;
            }
        }

        return this.#prefix;
    }

    // public
    toString () {
        if ( this.#string === undefined ) {
            if ( this.prefix !== null ) this.#string = this.toCIDRString();
            else this.#string = this.toRangeString();
        }

        return this.#string;
    }

    toJSON () {
        return this.toString();
    }

    toRangeString () {
        this.#rangeString ??= this.#firstAddr + "-" + this.#lastAddr;

        return this.#rangeString;
    }

    toCIDRString () {
        if ( this.#cidrString === undefined ) {
            if ( this.prefix == null ) this.#cidrString = null;
            else this.#cidrString = this.#firstAddr + "/" + this.prefix;
        }

        return this.#cidrString;
    }

    getRandomAddr () {
        var min = this.#firstAddr.value,
            max = this.#lastAddr.value;

        if ( this.isV4 ) {
            max = max - min + 1;

            return new IPAddr( min + Math.floor( Math.random() * max ) );
        }
        else {
            return new IPAddr( getRandomBigInt( min, max ) );
        }
    }

    contains ( range ) {
        var min, max;

        if ( typeof range === "number" || typeof range === "bigint" ) min = max = range;
        else if ( range instanceof IPAddr ) min = max = range.value;
        else {
            if ( typeof range === "string" ) range = new IPRange( range );

            if ( range instanceof IPRange ) {
                min = range.firstAddr.value;
                max = range.lastAddr.value;
            }
        }

        if ( typeof min === "number" && this.isV6 ) return false;

        if ( this.#firstAddr.value > min ) return false;

        if ( this.#lastAddr.value < max ) return false;

        return true;
    }

    inside ( range ) {
        if ( typeof range === "string" ) range = new IPRange( range );

        if ( this.isV4 && range.isV6 ) return false;

        if ( this.#firstAddr.value < range.firstAddr.value ) return false;

        if ( this.#lastAddr.value > range.lastAddr.value ) return false;

        return true;
    }
}
