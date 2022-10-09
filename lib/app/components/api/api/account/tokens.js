import mixins from "#lib/mixins";

export default Super =>
    class extends mixins( Super ) {
        async API_read ( ctx, options = {} ) {
            return this.api.getUserTokens( ctx.user.id, options, ctx );
        }

        async API_create ( ctx, name ) {
            return await this.api.createUserToken( ctx.user.id, name, true, {} );
        }

        async API_delete ( ctx, tokenId ) {
            const token = await this.api.getUserToken( tokenId );

            if ( !token ) return token;

            if ( token.data.user_id !== ctx.user.id ) return result( 404 );

            return this.api.deleteUserToken( tokenId );
        }

        async API_setEnabled ( ctx, tokenId, enabled ) {
            const token = await this.api.getUserToken( tokenId );

            if ( !token ) return token;

            if ( token.data.user_id !== ctx.user.id ) return result( 404 );

            return this.api.setUserTokenEnabled( tokenId, enabled );
        }

        async API_getRoles ( ctx, tokenId ) {
            const roles = await this.api.getUserTokenRoles( tokenId );

            return roles;
        }

        async API_setRoles ( ctx, tokenId, roles ) {

            // set roles
            return this.api.setUserTokenRoles( tokenId, roles, { "userId": ctx.user.id } );
        }

        async API_updateRoles ( ctx, tokenId, roles ) {

            // set roles
            return this.api.updateUserTokenRoles( tokenId, roles, { "userId": ctx.user.id } );
        }
    };
