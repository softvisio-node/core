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

const { IS_MIXIN } = require( "./const" );

module.exports.defineMixin = function ( generator ) {
    var factory = function ( SuperClass ) {
        return generator( SuperClass || Object );
    };

    factory[IS_MIXIN] = true;

    return factory;
};

module.exports.mix = function ( ...mixins ) {
    var Mix;

    for ( const mixin of mixins.reverse() ) {
        if ( !Mix ) {
            Mix = mixin[IS_MIXIN] ? mixin() : mixin;
        }
        else {
            Mix = mixin( Mix );
        }
    }

    return Mix;
};
