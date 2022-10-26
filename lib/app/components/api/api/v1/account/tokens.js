import mixins from "#lib/mixins";

export default Super =>
    class extends mixins( Super ) {
        async API_read ( ctx, options = {} ) {
            return this.api.userTokens.getUserTokens( ctx.user.id, options, ctx );
        }

        async API_create ( ctx, name ) {
            return await this.api.userTokens.createUserToken( ctx.user.id, name, true, {} );
        }

        async API_delete ( ctx, tokenId ) {
            const token = await this.api.userTokens.getUserToken( tokenId );

            if ( !token ) return token;

            if ( token.data.user_id !== ctx.user.id ) return result( 404 );

            return this.api.userTokens.deleteUserToken( tokenId );
        }

        async API_setEnabled ( ctx, tokenId, enabled ) {
            const token = await this.api.userTokens.getUserToken( tokenId );

            if ( !token ) return token;

            if ( token.data.user_id !== ctx.user.id ) return result( 404 );

            return this.api.userTokens.setUserTokenEnabled( tokenId, enabled );
        }

        async API_getRoles ( ctx, tokenId ) {
            const roles = await this.api.userTokesns.getUserTokenRoles( tokenId );

            return roles;
        }

        async API_setRoles ( ctx, tokenId, roles ) {

            // set roles
            return this.api.userTokens.setUserTokenRoles( tokenId, roles, { "userId": ctx.user.id } );
        }

        async API_updateRoles ( ctx, tokenId, roles ) {

            // set roles
            return this.api.userTokens.updateUserTokenRoles( tokenId, roles, { "userId": ctx.user.id } );
        }
    };
