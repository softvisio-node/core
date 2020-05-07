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

const isMixin = Symbol();

module.exports = function ( generator ) {
    var factory = function ( SuperClass ) {
        return generator( SuperClass || Object );
    };

    factory[isMixin] = true;

    return factory;
};

global.mix = function ( ...mixins ) {
    var Mix;

    for ( const mixin of mixins.reverse() ) {
        if ( !Mix ) {
            Mix = mixin[isMixin] ? mixin() : mixin;
        }
        else {
            Mix = mixin( Mix );
        }
    }

    return Mix;
};
