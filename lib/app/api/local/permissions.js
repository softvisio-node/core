const { mixin } = require( "../../../mixins" );

module.exports = mixin( Super =>
    class extends Super {
            #permissions = {};

            async init ( options = {} ) {

                // init permissions
                if ( options.permissions ) {
                    for ( const id in options.permissions ) {
                        if ( /[^a-z-]/.test( id ) ) return result( [400, `Permission name "${id}" is invalid`] );

                        this.#permissions[id] = {
                            id,
                            "default": options.permissions[id].default,
                            "name": options.permissions[id].name,
                            "description": options.permissions[id].description,
                        };
                    }
                }

                if ( super.init ) return await super.init( options );

                return result( 200 );
            }

            // XXX return {id: {name, description}}
            get userPermissions () {
                return this.#permissions;
            }

            // VALIDATORS
            validateApiPermissionName ( name ) {
                if ( name === "!" || name === "@" || name === "*" ) return result( 200 );

                return this.validateUserPermissionName( name );
            }

            validateUserPermissionName ( name ) {
                if ( !( name in this.#permissions ) ) return result( [400, `Permission name "${name}" in invalid`] );

                return result( 200 );
            }

            validateTokenPermissionName ( name ) {
                if ( !( name in this.#permissions ) ) return result( [400, `Permission name "${name}" in invalid`] );

                return result( 200 );
            }

            // XXX
            validateObjectPermissionName ( objectType, permissionName ) {
                return result( 200 );
            }
    } );
