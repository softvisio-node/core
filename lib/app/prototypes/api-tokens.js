import Base from "./base.js";

export default class extends Base {
    async API_read ( ctx, options = {} ) {
        return this.api.getUserTokens( ctx.userId, options, ctx );
    }

    async API_create ( ctx, name ) {
        return await this.api.createUserToken( ctx.userId, name, true, {} );
    }

    async API_delete ( ctx, tokenId ) {
        const token = await this.api.getUserToken( tokenId );

        if ( !token ) return token;

        if ( token.data.user_id !== ctx.userId ) return result( 404 );

        return this.api.removeUserToken( tokenId );
    }

    async API_setEnabled ( ctx, tokenId, enabled ) {
        const token = await this.api.getUserToken( tokenId );

        if ( !token ) return token;

        if ( token.data.user_id !== ctx.userId ) return result( 404 );

        return this.api.setUserTokenEnabled( tokenId, enabled );
    }

    async API_getPermissions ( ctx, tokenId ) {
        const permissions = await this.api.getUserTokenPermissions( tokenId );

        return permissions;
    }

    async API_setPermissions ( ctx, tokenId, permissions ) {

        // set permissions
        return this.api.setUserTokenPermissions( tokenId, permissions, { "userId": ctx.userId } );
    }

    async API_updatePermissions ( ctx, tokenId, permissions ) {

        // set permissions
        return this.api.updateUserTokenPermissions( tokenId, permissions, { "userId": ctx.userId } );
    }
}

// ----- SOURCE FILTER LOG BEGIN -----
//
// +----------+----------+--------------------------------------------------------------------------+
// | Severity |     Line | Desctiption                                                              |
// |==========+==========+==========================================================================|
// | ERROR    |    22:11 | @softvisio/camelcase, Identifier 'API_setEnabled' is not in camel case.  |
// |----------+----------+--------------------------------------------------------------------------|
// | ERROR    |    32:11 | @softvisio/camelcase, Identifier 'API_getPermissions' is not in camel    |
// |          |          | case.                                                                    |
// |----------+----------+--------------------------------------------------------------------------|
// | ERROR    |    38:11 | @softvisio/camelcase, Identifier 'API_setPermissions' is not in camel    |
// |          |          | case.                                                                    |
// |----------+----------+--------------------------------------------------------------------------|
// | ERROR    |    44:11 | @softvisio/camelcase, Identifier 'API_updatePermissions' is not in camel |
// |          |          | case.                                                                    |
// +----------+----------+--------------------------------------------------------------------------+
//
// ----- SOURCE FILTER LOG END -----
