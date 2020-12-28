const { mixin } = require( "../../mixins" );
const result = require( "../../result" );

module.exports = mixin( Super =>

/** class: ApiTokens
         * summary: User API access tokens management.
         * permissions:
         *   - '@'
         */
    class extends Super {

        /** method: API_read
             * summary: Read api tokens.
             * params:
             *   - name: options
             *     schema:
             *       type: object
             */
        async API_read ( auth, options = {} ) {
            return this.api.getUserTokens( auth.userId, options );
        }

        /** method: API_create
             * summary: Generate new API token.
             * params:
             *   - name: name
             *     required: true
             *     schema:
             *       type: string
             */
        async API_create ( auth, name ) {
            return await this.api.createUserToken( auth.userId, name, true, {} );
        }

        /** method: API_delete
             * summary: Remove API token.
             * params:
             *   - name: tokenId
             *     required: true
             *     schema:
             *       type: string
             */
        async API_delete ( auth, tokenId ) {
            const token = await this.api.getUserToken( tokenId );

            if ( !token ) return token;

            if ( token.data.user_id !== auth.userId ) return result( 404 );

            return this.api.removeUserToken( tokenId );
        }

        /** method: API_set_enabled
             * summary: Set API token enabled.
             * params:
             *   - name: tokenId
             *     required: true
             *     schema:
             *       type: string
             *   - name: enabled
             *     required: true
             *     schema:
             *       type: boolean
             */
        async API_set_enabled ( auth, tokenId, enabled ) {
            const token = await this.api.getUserToken( tokenId );

            if ( !token ) return token;

            if ( token.data.user_id !== auth.userId ) return result( 404 );

            return this.api.setUserTokenEnabled( tokenId, enabled );
        }

        /** method: API_get_permissions
             * summary: Get user permissions.
             * params:
             *   - name: tokenId
             *     required: true
             *     schema:
             *       type: string
             */
        async API_get_permissions ( auth, tokenId ) {
            const permissions = await this.api.getUserTokenPermissions( tokenId );

            return permissions;
        }

        // XXX
        /** method: API_set_permissions
             * summary: Set user permissions.
             * params:
             *   - name: userId
             *     required: true
             *     schema:
             *       type: integer
             *   - name: permissions
             *     required: true
             *     schema:
             *       type: object
             *       additionalProperties: { type: boolean }
             */
        async API_set_permissions ( auth, userId, permissions ) {

            // unabe to modify own permissions
            if ( userId === auth.userId ) return result( [400, "You are unable to change own permissions"] );

            // unable to modify root permissions
            if ( this.api.userIsRoot( userId ) ) return result( [400, "Unable to change root permissions"] );

            // check permissions
            if ( !auth.isRoot ) {
                for ( const permission in permissions ) {
                    if ( !auth.hasPermissions( [permission] ) ) return result( [400, "Permissions are invalid"] );
                }
            }

            // set permissions
            return this.api.setUserPermissions( userId, permissions );
        }

        // XXX
        /** method: API_update_permissions
             * summary: Set user permissions.
             * params:
             *   - name: userId
             *     required: true
             *     schema:
             *       type: integer
             *   - name: permissions
             *     required: true
             *     schema:
             *       type: object
             *       additionalProperties: { type: boolean }
             */
        async API_update_permissions ( auth, userId, permissions ) {

            // unabe to modify own permissions
            if ( userId === auth.userId ) return result( [400, "Unable to change own permissions"] );

            // unable to modify root permissions
            if ( this.api.userIsRoot( userId ) ) return result( [400, "You are unable to change own permissions"] );

            // check permissions
            if ( !auth.isRoot ) {
                for ( const permission in permissions ) {
                    if ( !auth.hasPermissions( [permission] ) ) return result( [400, "Permissions are invalid"] );
                }
            }

            // set permissions
            return this.api.updateUserPermissions( userId, permissions );
        }
    } );
