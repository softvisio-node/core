import IpRange from "#lib/ip/range";

export default class IpPool {
    #ranges = [];

    addRange ( range ) {
        range = new IpRange( range );

        this.#ranges.push( range );
    }

    contains ( range ) {
        if ( typeof range === "string" ) range = new IpRange( range );

        for ( const range1 of this.#ranges ) {
            if ( range1.contains( range ) ) return range1;
        }
    }
}
