import IpRange from "#lib/ip/range";
import AvlTree from "#lib/tree/avl";

export default class IpRangeSet {
    #rangesIpV4 = [];
    #rangesIpV6 = [];
    #avlIpV4 = new AvlTree();
    #avlIpV6 = new AvlTree();
    #firstAddressIpV4;
    #lastAddressIpV4;
    #firstAddressIpV6;
    #lastAddressIpV6;

    addRange ( range ) {
        range = new IpRange( range );

        if ( range.isIpV4 ) {
            this.#rangesIpV4.push( range );
            this.#avlIpV4.set( range.firstAddress.value, range );

            if ( !this.#firstAddressIpV4 || this.#firstAddressIpV4.value > range.firstAddress.value ) this.#firstAddressIpV4 = range.firstAddress;

            if ( !this.#lastAddressIpV4 || this.#lastAddressIpV4.value < range.lastAddress.value ) this.#lastAddressIpV4 = range.lastAddress;
        }
        else {
            this.#rangesIpV6.push( range );
            this.#avlIpV6.set( range.firstAddress.value, range );

            if ( !this.#firstAddressIpV6 || this.#firstAddressIpV6.value > range.firstAddress.value ) this.#firstAddressIpV6 = range.firstAddress;

            if ( !this.#lastAddressIpV6 || this.#lastAddressIpV6.value < range.lastAddress.value ) this.#lastAddressIpV6 = range.lastAddress;
        }

        return this;
    }

    contains ( range, avl ) {
        range = IpRange.new( range );

        var ranges;

        if ( range.isIpV4 ) {
            if ( !this.#rangesIpV4.length ) return;

            if ( range.firstAddress.value < this.#firstAddressIpV4.value || range.lastAddress.value > this.#lastAddressIpV4.value ) return;

            ranges = avl ? this.#avlIpV4 : this.#rangesIpV4;
        }
        else {
            if ( !this.#rangesIpV6.length ) return;

            if ( range.firstAddress.value < this.#firstAddressIpV6.value || range.lastAddress.value > this.#lastAddressIpV6.value ) return;

            ranges = avl ? this.#avlIpV6 : this.#rangesIpV6;
        }

        return avl ? this.#avlSearch( range, ranges ) : this.#linearSearch( range, ranges );
    }

    // private
    #linearSearch ( range, ranges ) {
        for ( const _range of ranges ) {
            if ( _range.contains( range ) ) return _range;
        }
    }

    #avlSearch ( range, avl ) {
        const min = range.firstAddress.value,
            max = range.lastAddress.value,
            q = [avl.root];

        while ( q.length ) {
            const node = q.pop();

            if ( node.value.firstAddress.value <= min ) {

                // range found
                if ( node.value.lastAddress.value >= max ) return node.value;

                if ( node.right ) q.push( node.right );
            }
            else {
                if ( node.left ) q.push( node.left );
            }
        }
    }
}
