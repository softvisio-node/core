/** summary: ES6 classes mixins
 * description: |
 *   const mixin = require( "@softvisio/core/mixins" );
 *   const Mixin = mixin( Super => class extends Super { ... } )
 *   // Class -> Mixin
 *   var Class = class extends Mixin() { ... }
 *   // Class -> Mixin -> Super
 *   var Class = class extends Mixin( Super ) { ... }
 *   // Class -> Mixin1 -> Mixin2 -> Super -> ...
 *   var Class = class extends mix( Mixin1, Mixin2, Super ) { ... }
 */

class Mixin {
    static mixin ( generator ) {
        return new Mixin( generator );
    }

    static mix ( ...mixins ) {
        var Class;

        for ( const mixin of mixins.reverse() ) {
            if ( !Class ) {
                Class = mixin instanceof Mixin ? mixin.build() : mixin;
            }
            else {
                Class = mixin.build( Class );
            }
        }

        return Class;
    }

    #generator;

    constructor ( generator ) {
        this.#generator = generator;
    }

    build ( Super ) {
        return this.#generator( Super || Object );
    }
}

module.exports = Mixin;
