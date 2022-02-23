import IpRange from "#lib/ip/range";

export default class IpRangeSet {
    #rangesIpV4 = [];
    #rangesIpV6 = [];
    #firstAddressIpV4;
    #lastAddressIpV4;
    #firstAddressIpV6;
    #lastAddressIpV6;

    // TODO
    // find first index, where range.first >= index.first;
    // find last index, where range.last <= index.last;
    // for firstIndex ... lastIndex - compare ranges;

    addRange ( range ) {
        range = new IpRange( range );

        if ( range.isIpV4 ) {
            this.#rangesIpV4.push( range );

            if ( !this.#firstAddressIpV4 || this.#firstAddressIpV4.value > range.firstAddress.value ) this.#firstAddressIpV4 = range.firstAddress;

            if ( !this.#lastAddressIpV4 || this.#lastAddressIpV4.value < range.lastAddress.value ) this.#lastAddressIpV4 = range.lastAddress;
        }
        else {
            this.#rangesIpV6.push( range );

            if ( !this.#firstAddressIpV6 || this.#firstAddressIpV6.value > range.firstAddress.value ) this.#firstAddressIpV6 = range.firstAddress;

            if ( !this.#lastAddressIpV6 || this.#lastAddressIpV6.value < range.lastAddress.value ) this.#lastAddressIpV6 = range.lastAddress;
        }

        return this;
    }

    contains ( range ) {
        range = IpRange.new( range );

        var ranges;

        if ( range.isIpV4 ) {
            if ( !this.#rangesIpV4.length ) return;

            if ( range.firstAddress.value < this.#firstAddressIpV4.value || range.lastAddress.value > this.#lastAddressIpV4.value ) return;

            ranges = this.#rangesIpV4;
        }
        else {
            if ( !this.#rangesIpV6.length ) return;

            if ( range.firstAddress.value < this.#firstAddressIpV6.value || range.lastAddress.value > this.#lastAddressIpV6.value ) return;

            ranges = this.#rangesIpV6;
        }

        return this.#linearSearch( range, ranges );
    }

    // private
    #linearSearch ( range, ranges ) {
        for ( const _range of ranges ) {
            if ( _range.contains( range ) ) return _range;
        }
    }
}
