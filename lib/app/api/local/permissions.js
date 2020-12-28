const { mixin } = require( "../../../mixins" );

module.exports = mixin( Super =>
    class extends Super {
            #permissions = {};

            async init ( options = {} ) {

                // init permissions
                if ( options.permissions ) this.#initPermissions( options.permissions );

                if ( super.init ) return await super.init( options );

                return result( 200 );
            }

            // XXX
            #initPermissions ( permissions ) {
                this.#permissions = permissions;

                // validate permissions names
                for ( const name in this.#permissions ) {
                    if ( /[^a-z-]/.test( name ) ) return result( [400, `Permission name "${name}" is invalid`] );
                }
            }

            // XXX return {id: {name, description}}
            get userPermissions () {
                return this.#permissions;
            }

            // XXX
            validateApiPermissionName ( name ) {
                if ( name === "!" || name === "@" || name === "*" ) return result( 200 );

                // if ( !( name in this.#permissions ) ) return result( [400, "Permission name is unknown"] );

                return result( 200 );
            }

            // XXX
            validateUserPermissionName ( name ) {
                return result( 200 );
            }

            // XXX
            validateTokenPermissionName ( name ) {
                return result( 200 );
            }

            // XXX
            validateObjectPermission ( objectType, permissionName ) {
                return result( 200 );
            }
    } );
