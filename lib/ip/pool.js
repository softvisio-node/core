import IPRange from "#lib/ip/range";

export class IPPool {
    #ranges = [];

    addRange ( range ) {
        range = new IPRange( range );

        this.#ranges.pull( range );
    }

    contains ( range ) {
        if ( typeof range === "string" ) range = new IPRange( range );

        for ( const range1 of this.#ranges ) {
            if ( range1.contains( range ) ) return range1;
        }
    }
}
