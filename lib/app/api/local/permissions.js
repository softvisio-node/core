const { mixin } = require( "../../../mixins" );

module.exports = mixin( Super =>
    class extends Super {
            #permissions = {};
            #rootPermissions = {};
            #userPermissions = {};
            #objectPermissions = {};

            async init ( options = {} ) {
                process.stdout.write( "Loading API permissions ... " );
                var res = await this.#init( options );
                console.log( res + "" );

                if ( !res.ok ) return res;

                res = super.init ? await super.init( options ) : result( 200 );

                return res;
            }

            async #init ( options ) {

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

                return result( 200 );
            }

            // VALIDATORS
            validateApiPermissions ( permissions ) {
                if ( !Array.isArray( permissions ) ) permissions = [permissions];

                const invalid = [];

                for ( const permission of permissions ) {
                    if ( permission !== "!" && permission !== "@" && permission !== "*" ) invalid.push( permission );
                }

                if ( invalid.length ) {
                    return this.validateUserPermissions( invalid );
                }
                else {
                    return result( 200 );
                }
            }

            validateUserPermissions ( permissions ) {
                if ( !Array.isArray( permissions ) ) permissions = [permissions];

                const invalid = [];

                for ( const permission of permissions ) {
                    if ( !( permission in this.#permissions ) ) invalid.push( permission );
                }

                if ( invalid.length ) {
                    return result( [400, `Permissions "${invalid.map( name => `"${name}"` ).join( ", " )}" are invalid`] );
                }
                else {
                    return result( 200 );
                }
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

                    // for root user all permissions are enabled
                    _userPermissions = { ...this.#rootPermissions };
                }

                // non-root user
                else {
                    _userPermissions = {};

                    for ( const permission in this.#userPermissions ) {
                        const enabled = userPermissions[permission] ?? this.#userPermissions[permission];

                        // take only enabled user permissions
                        if ( enabled ) _userPermissions[permission] = true;
                    }
                }

                if ( !tokenPermissions ) return _userPermissions;

                const _tokenPermissions = {};

                // build token permissions
                for ( const permission in _userPermissions ) {

                    // all token permissions are disabled by default
                    const enabled = !!tokenPermissions[permission];

                    // take only enabled token permissions
                    if ( enabled ) _tokenPermissions[permission] = true;
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
