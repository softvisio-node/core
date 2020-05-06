/** SYNOPSIS
name: mixins
summary: ES6 classes mixins
synopsis: |
    const defineMixin = require( "@softvisio/core/mixins" );

    const Mixin = defineMixin( SuperClass => class extends SuperClass { ... } )

    // Class -> Mixin
    var Class = class extends Mixin() { ... }

    // Class -> Mixin -> SuperClass
    var Class = class extends Mixin( SuperClass ) { ... }

    // Class -> Mixin1 -> Mixin2 -> SuperClass -> ...
    var Class = class extends mix( Mixin1, Mixin2, SuperClass ) { ... }

changes: no changes
*/

const { isConstructor } = require( "./util" );

module.exports = function ( generator ) {
    return function ( SuperClass ) {
        return generator( SuperClass || Object );
    };
};

global.mix = function ( ...mixins ) {
    var Mix;

    for ( const mixin of mixins.reverse() ) {
        if ( !Mix ) {
            Mix = isConstructor( mixin ) ? mixin : mixin();
        }
        else {
            Mix = mixin( Mix );
        }
    }

    return Mix;
};
