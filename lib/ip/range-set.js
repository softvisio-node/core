import IpRange from "#lib/ip/range";

export default class IpRangeSet {
    #rangesV4 = [];
    #rangesV6 = [];

    addRange ( range ) {
        range = new IpRange( range );

        if ( range.isIpV4 ) this.#rangesV4.push( range );
        else this.#rangesV6.push( range );

        return this;
    }

    contains ( range ) {
        range = IpRange.new( range );

        const ranges = range.isIpV4 ? this.#rangesV4 : this.#rangesV6;

        for ( const _range of ranges ) {
            if ( _range.contains( range ) ) return _range;
        }
    }
}
