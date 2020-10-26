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

const { OBJECT_IS_MIXIN } = require( "./const" );
const { objectIsMixin } = require( "./util" );

module.exports.mixin = function ( generator ) {
    var factory = function ( Super ) {
        return generator( Super || Object );
    };

    factory[OBJECT_IS_MIXIN] = true;

    return factory;
};

module.exports.mix = function ( ...mixins ) {
    var Mix;

    for ( const mixin of mixins.reverse() ) {
        if ( !Mix ) {
            Mix = objectIsMixin( mixin ) ? mixin() : mixin;
        }
        else {
            Mix = mixin( Mix );
        }
    }

    return Mix;
};
