const RESERVED_PERMISSIONS_NAMES = new Set( ["*", "guest", "root", "user"] );
import { isKebabCase } from "#lib/utils/naming-conventions";

export default Super =>
    class extends ( Super || Object ) {
        #permissions = {};
        #rootPermissions = {};
        #userPermissions = {};

        async _new ( options = {} ) {
            var res;

            if ( options.permissions ) {
                process.stdout.write( "Loading user permissions ... " );
                res = await this.#init( options.permissions );
                console.log( res + "" );

                if ( !res.ok ) return res;
            }

            res = super._new ? await super._new( options ) : result( 200 );

            return res;
        }

        async #init ( permissions ) {

            // init permissions
            for ( const id in permissions ) {
                if ( RESERVED_PERMISSIONS_NAMES.has( id ) ) return result( [400, `Permission name "${id}" is reserved`] );

                if ( !isKebabCase( id ) ) return result( [400, `Permission name "${id}" must be in the kebab-case`] );

                this.#permissions[id] = {
                    id,
                    "default": !!permissions[id].default,
                    "name": permissions[id].name,
                    "description": permissions[id].description,
                };

                this.#rootPermissions[id] = true;

                this.#userPermissions[id] = this.#permissions[id].default;
            }

            return result( 200 );
        }

        // VALIDATORS
        _validateApiPermissions ( permissions ) {
            if ( !Array.isArray( permissions ) ) permissions = [permissions];

            const invalid = permissions.filter( permission => !RESERVED_PERMISSIONS_NAMES.has( permission ) );

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
                return result( [400, `Permissions: ${invalid.map( name => `"${name}"` ).join( ", " )} are invalid`] );
            }
            else {
                return result( 200 );
            }
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
    };
