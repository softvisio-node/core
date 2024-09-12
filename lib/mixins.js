export default function mixins ( ...mixins ) {
    var Class;

    for ( const mixin of mixins.reverse() ) {
        if ( !Class ) {
            Class = mixin.prototype
                ? mixin
                : mixin(); // arrow functions has no prototype
        }
        else {
            Class = mixin( Class );
        }
    }

    return Class;
}
