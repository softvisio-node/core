const { mixin } = require( "../../../mixins" );

module.exports = mixin( Super =>
    class extends Super {
            #permissions = {};
            #userPermissions = {};

            async init ( options = {} ) {

                // init permissions
                if ( options.permissions ) {
                    for ( const id in options.permissions ) {
                        if ( /[^a-z-]/.test( id ) ) return result( [400, `Permission name "${id}" is invalid`] );

                        this.#permissions[id] = {
                            id,
                            "default": !!options.permissions[id].default,
                            "name": options.permissions[id].name,
                            "description": options.permissions[id].description,
                        };

                        this.#userPermissions[id] = this.#permissions[id].default;
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

            // MERGERS
            mergeUserPermissions ( userPermissions, tokenPermissions ) {
                const permissions = { ...this.#userPermissions };

                if ( userPermissions ) {
                    Object.entries( userPermissions ).forEach( entry => {

                        // owerride only permissions, which are exists
                        if ( entry[0] in permissions ) permissions[entry[0]] = entry[1];
                    } );
                }

                if ( tokenPermissions ) {
                    Object.entries( tokenPermissions ).forEach( entry => {

                        // override only permissions, which are enabled
                        if ( permissions[entry[0]] ) permissions[entry[0]] = entry[1];
                    } );
                }

                return permissions;
            }
    } );
