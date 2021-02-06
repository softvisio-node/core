/** summary: ES6 classes mixins
 * description: |
 *   const mixins = require( "@softvisio/core/mixins" );
 *   const Mixin = Super => class extends ( Super || Object ) { ... };
 *   // Class -> Mixin
 *   var Class = class extends Mixin() { ... }
 *   // Class -> Mixin -> Super
 *   var Class = class extends Mixin( Super ) { ... }
 *   // Class -> Mixin1 -> Mixin2 -> Super -> ...
 *   var Class = class extends mixins( Mixin1, Mixin2, Super ) { ... }
 */

module.exports = function ( ...mixins ) {
    var Class;

    for ( const mixin of mixins.reverse() ) {
        if ( !Class ) {
            Class = mixin.constructor ? mixin : mixin();
        }
        else {
            Class = mixin( Class );
        }
    }

    return Class;
};
