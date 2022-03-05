import IpRange from "#lib/ip/range";
import AvlTree from "#lib/tree/avl";

export default class IpRangeSet {
    #avlIpV4 = new AvlTree();
    #avlIpV6 = new AvlTree();
    #firstAddressIpV4;
    #lastAddressIpV4;
    #firstAddressIpV6;
    #lastAddressIpV6;

    // properties
    get firstAddressIpV4 () {
        return this.#firstAddressIpV4;
    }

    get lastAddressIpV4 () {
        return this.#lastAddressIpV4;
    }

    get firstAddressIpV6 () {
        return this.#firstAddressIpV6;
    }

    get lastAddressIpV6 () {
        return this.#lastAddressIpV6;
    }

    // public
    add ( range ) {
        range = new IpRange( range );

        if ( range.isIpV4 ) {
            this.#avlIpV4.set( range.firstAddress.value, range );

            if ( !this.#firstAddressIpV4 || this.#firstAddressIpV4.value > range.firstAddress.value ) this.#firstAddressIpV4 = range.firstAddress;

            if ( !this.#lastAddressIpV4 || this.#lastAddressIpV4.value < range.lastAddress.value ) this.#lastAddressIpV4 = range.lastAddress;
        }
        else {
            this.#avlIpV6.set( range.firstAddress.value, range );

            if ( !this.#firstAddressIpV6 || this.#firstAddressIpV6.value > range.firstAddress.value ) this.#firstAddressIpV6 = range.firstAddress;

            if ( !this.#lastAddressIpV6 || this.#lastAddressIpV6.value < range.lastAddress.value ) this.#lastAddressIpV6 = range.lastAddress;
        }

        return this;
    }

    includes ( range ) {
        range = IpRange.new( range );

        if ( range.isIpV4 ) {
            if ( this.#avlIpV4.isEmpty ) return;

            if ( range.firstAddress.value < this.#firstAddressIpV4.value || range.lastAddress.value > this.#lastAddressIpV4.value ) return;

            return this.#avlSearch( range, this.#avlIpV4 );
        }
        else {
            if ( this.#avlIpV6.isEmpty ) return;

            if ( range.firstAddress.value < this.#firstAddressIpV6.value || range.lastAddress.value > this.#lastAddressIpV6.value ) return;

            return this.#avlSearch( range, this.#avlIpV6 );
        }
    }

    clear () {
        this.#avlIpV4.clear();
        this.#avlIpV6.clear();

        this.#firstAddressIpV4 = null;
        this.#lastAddressIpV4 = null;

        this.#firstAddressIpV6 = null;
        this.#lastAddressIpV6 = null;
    }

    toString () {
        const ranges = [];

        if ( !this.#avlIpV4.isEmpty ) {
            ranges.push( this.#avlIpV4
                .values()
                .map( range => range.toString() )
                .join( ", " ) );
        }

        if ( !this.#avlIpV6.isEmpty ) {
            ranges.push( this.#avlIpV6
                .values()
                .map( range => range.toString() )
                .join( ", " ) );
        }

        return ranges.join( ", " );
    }

    // private
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
