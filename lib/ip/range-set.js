import IpRange from "#lib/ip/range";
import AvlTree from "#lib/data-structures/avl-tree";
import Events from "#lib/events";

export default class IpRangeSet extends Events {
    #avlIpV4 = new AvlTree();
    #avlIpV6 = new AvlTree();
    #toString;

    constructor ( ranges ) {
        super();

        if ( ranges ) this.#add( ranges );
    }

    // public
    add ( ranges ) {
        const updated = this.#add( ranges );

        if ( updated ) this.emit( "update" );

        return this;
    }

    // XXX
    set ( ranges ) {
        if ( !Array.isArray( ranges ) ) ranges = [ranges];

        ranges = ranges.filter( range => range ).map( range => IpRange.new( range ) );

        var updated = this.#add( ranges );

        // XXX

        if ( updated ) {
            this.#toString = null;

            this.emit( "update" );
        }

        return this;
    }

    delete ( ranges ) {
        const updated = this.#delete( ranges );

        if ( updated ) this.emit( "update" );

        return this;
    }

    clear () {
        const updated = this.#clear();

        if ( updated ) this.emit( "update" );

        return this;
    }

    includes ( range ) {
        range = IpRange.new( range );

        if ( range.isIpV4 ) {
            if ( this.#avlIpV4.isEmpty ) return;

            return this.#avlSearch( range, this.#avlIpV4 );
        }
        else {
            if ( this.#avlIpV6.isEmpty ) return;

            return this.#avlSearch( range, this.#avlIpV6 );
        }
    }

    toString () {
        if ( this.#toString == null ) {
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

            this.#toString = ranges.join( ", " );
        }

        return this.#toString;
    }

    toJSON () {
        const ranges = [];

        if ( !this.#avlIpV4.isEmpty ) {
            ranges.push( ...this.#avlIpV4.values().map( range => range.toString() ) );
        }

        if ( !this.#avlIpV6.isEmpty ) {
            ranges.push( ...this.#avlIpV6.values().map( range => range.toString() ) );
        }

        return ranges;
    }

    // private
    #add ( ranges ) {
        var updated;

        if ( !Array.isArray( ranges ) ) ranges = [ranges];

        for ( let range of ranges ) {
            if ( !range ) continue;

            range = IpRange.new( range );

            if ( range.isIpV4 ) {
                if ( this.#avlIpV4.has( range.firstAddress.value ) ) continue;

                updated = true;

                this.#avlIpV4.set( range.firstAddress.value, range );
            }
            else {
                if ( this.#avlIpV6.has( range.firstAddress.value ) ) continue;

                updated = true;

                this.#avlIpV6.set( range.firstAddress.value, range );
            }
        }

        if ( updated ) this.#toString = null;

        return updated;
    }

    #delete ( ranges ) {
        var updated;

        if ( !Array.isArray( ranges ) ) ranges = [ranges];

        for ( let range of ranges ) {
            if ( !range ) continue;

            range = IpRange.new( range );

            if ( range.isIpV4 ) {
                if ( this.#avlIpV4.has( range.firstAddress.value ) ) {
                    this.#avlIpV4.delete( range.firstAddress.value );

                    updated = true;
                }
            }
            else {
                if ( this.#avlIpV6.has( range.firstAddress.value ) ) {
                    this.#avlIpV6.delete( range.firstAddress.value );

                    updated = true;
                }
            }
        }

        if ( updated ) this.#toString = null;

        return updated;
    }

    #clear () {
        var updated;

        if ( !this.#avlIpV4.isEmpty ) {
            updated = true;

            this.#avlIpV4.clear();
        }

        if ( !this.#avlIpV6.isEmpty ) {
            updated = true;

            this.#avlIpV6.clear();
        }

        if ( updated ) this.#toString = null;

        return updated;
    }

    #avlSearch ( range, avl ) {
        const min = range.firstAddress.value,
            max = range.lastAddress.value;

        var node = avl.root;

        while ( node ) {
            if ( node.value.firstAddress.value <= min ) {

                // range found
                if ( node.value.lastAddress.value >= max ) return node.value;

                node = node.right;
            }
            else {
                node = node.left;
            }
        }
    }
}
