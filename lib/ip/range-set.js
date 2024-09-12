import IpRange from "#lib/ip/range";
import AvlTree from "#lib/data-structures/avl-tree";
import Events from "#lib/events";

export default class IpRangeSet extends Events {
    #avlIpV4 = new AvlTree();
    #avlIpV6 = new AvlTree();
    #toString;
    #ranges = {
        "4": {
            "first": null,
            "last": null,
        },
        "6": {
            "first": null,
            "last": null,
        },
    };

    constructor ( ranges ) {
        super();

        if ( ranges ) this.#add( ranges );
    }

    // public
    add ( ranges ) {
        const updated = this.#add( ranges );

        if ( updated ) this.#onUpdate();

        return this;
    }

    set ( ranges ) {
        if ( !Array.isArray( ranges ) ) ranges = [ ranges ];

        ranges = ranges.filter( range => range ).map( range => IpRange.new( range ) );

        const keys = new Set( ranges.map( range => range.firstAddress.value ) );

        var updated;

        // delete v4
        for ( const key of this.#avlIpV4.keys() ) {
            if ( !keys.has( key ) ) {
                updated = true;

                this.#avlIpV4.delete( key );
            }
        }

        // delete v6
        for ( const key of this.#avlIpV6.keys() ) {
            if ( !keys.has( key ) ) {
                updated = true;

                this.#avlIpV6.delete( key );
            }
        }

        // add ranges
        if ( this.#add( ranges ) ) updated = true;

        if ( updated ) {
            this.#clearCache();

            this.#onUpdate();
        }

        return this;
    }

    delete ( ranges ) {
        const updated = this.#delete( ranges );

        if ( updated ) this.#onUpdate();

        return this;
    }

    clear () {
        const updated = this.#clear();

        if ( updated ) this.#onUpdate();

        return this;
    }

    includes ( range ) {
        range = IpRange.new( range );

        if ( range.isIpV4 ) {
            return this.#avlSearch( range, this.#avlIpV4 );
        }
        else {
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

        if ( !Array.isArray( ranges ) ) ranges = [ ranges ];

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

        if ( updated ) this.#clearCache();

        return updated;
    }

    #delete ( ranges ) {
        var updated;

        if ( !Array.isArray( ranges ) ) ranges = [ ranges ];

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

        if ( updated ) this.#clearCache();

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

        if ( updated ) this.#clearCache();

        return updated;
    }

    #avlSearch ( range, avl ) {
        if ( avl.isEmpty ) return;

        const type = range.isIpV4
            ? this.#ranges[ "4" ]
            : this.#ranges[ "6" ];

        // defive full range
        if ( !type.first ) {
            avl.forEach( ( node, index ) => {
                if ( !type.first || type.first.value > node.value.firstAddress.value ) {
                    type.first = node.value.firstAddress;
                }

                if ( !type.last || type.last.value < node.value.lastAddress.value ) {
                    type.last = node.value.lastAddress;
                }
            } );
        }

        const min = range.firstAddress.value,
            max = range.lastAddress.value;

        // check full range
        if ( min < type.first.value ) return;
        if ( max > type.last.value ) return;

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

    #clearCache () {
        this.#toString = null;

        this.#ranges[ "4" ].first = null;
        this.#ranges[ "4" ].last = null;

        this.#ranges[ "6" ].first = null;
        this.#ranges[ "6" ].last = null;
    }

    #onUpdate () {
        this.emit( "update" );
    }
}
