import Base from "../base.js";

export default class extends Base {
    async API_read ( ctx, options = {} ) {
        return this.api.getUserApiKeys( ctx.userId, options, ctx );
    }

    async API_create ( ctx, name ) {
        return await this.api.createUserApiKey( ctx.userId, name, true, {} );
    }

    async API_delete ( ctx, tokenId ) {
        const token = await this.api.getUserToken( tokenId );

        if ( !token ) return token;

        if ( token.data.user_id !== ctx.userId ) return result( 404 );

        return this.api.deleteUserToken( tokenId );
    }

    async API_setEnabled ( ctx, tokenId, enabled ) {
        const token = await this.api.getUserToken( tokenId );

        if ( !token ) return token;

        if ( token.data.user_id !== ctx.userId ) return result( 404 );

        return this.api.setUserApiKeyEnabled( tokenId, enabled );
    }

    async API_getRoles ( ctx, tokenId ) {
        const roles = await this.api.getUserApiKeyRoles( tokenId );

        return roles;
    }

    async API_setRoles ( ctx, tokenId, roles ) {

        // set roles
        return this.api.setUserApiKeyRoles( tokenId, roles, { "userId": ctx.userId } );
    }

    async API_updateRoles ( ctx, tokenId, roles ) {

        // set roles
        return this.api.updateUserApiKeyRoles( tokenId, roles, { "userId": ctx.userId } );
    }
}
