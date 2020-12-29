const { mixin } = require( "../../../mixins" );

module.exports = mixin( Super =>
    class extends Super {
            #permissions = {};
            #rootPermissions = {};
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

                        this.#rootPermissions[id] = true;

                        this.#userPermissions[id] = this.#permissions[id].default;
                    }
                }

                if ( super.init ) return await super.init( options );

                return result( 200 );
            }

            get _userPermissions () {
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

            // XXX
            validateObjectPermissionName ( objectType, permissionName ) {
                return result( 200 );
            }

            // BUILDERS
            _buildUserPermissions ( userId, userPermissions, tokenPermissions ) {
                var _userPermissions;

                // root user
                if ( this.userIsRoot( userId ) ) {
                    _userPermissions = { ...this.#rootPermissions };
                }

                // non-root user
                else {
                    _userPermissions = { ...this.#userPermissions };

                    // apply custom user permissions
                    if ( userPermissions ) {
                        for ( const permission in userPermissions ) {

                            // override only permissions, which are exists
                            if ( permission in _userPermissions ) _userPermissions[permission] = userPermissions[permission];
                        }
                    }
                }

                if ( !tokenPermissions ) return _userPermissions;

                const _tokenPermissions = {};

                // build token permissions
                for ( const permission in _userPermissions ) {

                    // all token permissions are disabled by default
                    // only enabled user permissions can be overwritten with the custom token permissions
                    _tokenPermissions[permission] = _userPermissions[permission] && tokenPermissions[permission];
                }

                return _tokenPermissions;
            }

            _addPermissionsMetadata ( permissions ) {
                for ( const row of permissions ) {
                    row.name = this.#permissions[row.id].name;
                    row.description = this.#permissions[row.id].description;
                }
            }
    } );
