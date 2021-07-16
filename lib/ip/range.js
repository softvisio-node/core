import ipNum from "ip-num";
import IPAddr from "./addr.js";
import { getRandomBigInt } from "#lib/utils";

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

    // XXX
    constructor ( range ) {

        // IPRange
        if ( range instanceof IPRange ) range = range.toString();

        // IPAddr
        else if ( range instanceof IPAddr ) range = range.toString();

        // string
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
            if ( range.includes( "." ) ) {
                this.#isV4 = true;

                range = ipNum.RangedSet.fromSingleIP( new ipNum.IPv4( range ) );
            }
            else {
                this.#isV6 = true;

                range = ipNum.RangedSet.fromSingleIP( new ipNum.IPv6( range ) );
            }

            this.#isCidrAble = true;
        }

        this.#_ipNumRangedSet = range;
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

    get firstAddr () {
        if ( !this.#firstAddr ) this.#firstAddr = new IPAddr( this.#ipNumRangedSet.getFirst() );

        return this.#firstAddr;
    }

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
        var min = this.firstAddr.value,
            max = this.lastAddr.value;

        if ( this.#isV4 ) {
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

        if ( typeof min === "number" && this.#isV6 ) return false;

        if ( this.firstAddr.value > min ) return false;

        if ( this.lastAddr.value < max ) return false;

        return true;
    }

    inside ( range ) {
        if ( typeof range === "string" ) range = new IPRange( range );

        if ( this.#isV4 && range.isV6 ) return false;

        if ( this.firstAddr.value < range.firstAddr.value ) return false;

        if ( this.lastAddr.value > range.lastAddr.value ) return false;

        return true;
    }

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
