import IPAddr from "#lib/ip/addr";
import { getRandomBigInt } from "#lib/utils";

const PARSING_ERROR_MESSAGE = `IP range is invalid`;

const V4_MASK = new Array( 32 );
const V6_MASK0 = new Array( 128 );
const V6_MASK1 = new Array( 128 );

export default class IPRange {
    #first;
    #last;
    #prefix;

    constructor ( range ) {
        if ( typeof range === "string" ) {
            let idx = range.indexOf( "/" );

            // cidr notation
            if ( idx > 0 ) {
                const prefix = +range.substr( idx + 1 );

                if ( isNaN( prefix ) || prefix < 0 || prefix > 128 ) throw Error( PARSING_ERROR_MESSAGE );

                const addr = new IPAddr( range.substring( 0, idx ) );

                // v4
                if ( addr.isV4 ) {
                    if ( prefix > 32 ) throw Error( PARSING_ERROR_MESSAGE );

                    V4_MASK[prefix] ??= Number( "0b" + "1".repeat( prefix ) + "0".repeat( 32 - prefix ) );

                    this.#first = new IPAddr( addr.value & V4_MASK[prefix] );
                    this.#last = new IPAddr( addr.value | ~V4_MASK[prefix] );
                }

                // v6
                else {
                    V6_MASK0[prefix] ??= BigInt( "0b" + "1".repeat( prefix ) + "0".repeat( 128 - prefix ) );
                    this.#first = new IPAddr( addr.value & V6_MASK0[prefix] );

                    V6_MASK1[prefix] = BigInt( "0b" + "0".repeat( prefix ) + "1".repeat( 128 - prefix ) );
                    this.#last = new IPAddr( addr.value | V6_MASK1[prefix] );
                }

                this.#prefix = prefix;
            }
            else {
                idx = range.indexOf( "-" );

                // range string
                if ( idx > 0 ) {
                    this.#first = new IPAddr( range.substring( 0, idx ) );
                    this.#last = new IPAddr( range.substr( idx + 1 ) );

                    if ( this.#first.isV4 && !this.#last.isV4 ) throw Error( PARSING_ERROR_MESSAGE );

                    // swap first <-> last
                    if ( this.#first.value > this.#last.value ) [this.#first, this.#last] = [this.#last, this.#first];
                }

                // single ip address
                else {
                    this.#first = new IPAddr( range );
                    this.#last = this.#first;
                }
            }
        }

        // invalid type
        else {
            throw Error( PARSING_ERROR_MESSAGE );
        }
    }

    // properties
    get isV4 () {
        return this.#first.isV4;
    }

    get isV6 () {
        return this.#first.isV6;
    }

    get first () {
        return this.#first;
    }

    get last () {
        return this.#last;
    }

    get size () {
        if ( this.isV4 ) {
            return this.#last.value - this.#first.value + 1;
        }
        else {
            return this.#last.value - this.#first.value + 1n;
        }
    }

    get isCIDRAble () {
        return this.prefic === null;
    }

    get prefix () {
        if ( this.#prefix === undefined ) {
            const isV4 = this.#first.isV4;

            if ( this.#first.value === this.#last.value ) {
                this.#prefix = isV4 ? 32 : 128;
            }
            else {
                let first = this.#first.value.toString( 2 ),
                    last = this.#last.value.toString( 2 );

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
        if ( this.prefix !== null ) return this.toCIDRString();
        else return this.toRangeString();
    }

    toJSON () {
        return this.toString();
    }

    toRangeString () {
        return this.#first + "-" + this.#last;
    }

    toCIDRString () {
        if ( this.prefix == null ) return;

        return this.#first + "/" + this.prefix;
    }

    getRandomAddr () {
        var min = this.#first.value,
            max = this.#last.value;

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
                min = range.first.value;
                max = range.last.value;
            }
        }

        if ( typeof min === "number" && this.isV6 ) return false;

        if ( this.#first.value > min ) return false;

        if ( this.#last.value < max ) return false;

        return true;
    }

    inside ( range ) {
        if ( typeof range === "string" ) range = new IPRange( range );

        if ( this.isV4 && range.isV6 ) return false;

        if ( this.#first.value < range.first.value ) return false;

        if ( this.#last.value > range.last.value ) return false;

        return true;
    }
}
