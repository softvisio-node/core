import mixins from "#lib/mixins";

export default Super =>
    class extends mixins( Super ) {
        async API_getAclPermissions ( ctx, aclId ) {
            return this.api.acl.getAclUserPermissions( aclId, ctx.user.id );
        }

        async API_getUsers ( ctx, aclId ) {
            return this.api.acl.getAclUsers( aclId, { "editorUserId": ctx.user.id } );
        }

        async API_getAclUserScopes ( ctx, aclId, userId ) {
            return this.api.acl.getAclUserScopes( aclId, userId, ctx.user.id );
        }

        async API_getScopess ( ctx, aclId ) {
            return this.api.acl.getAclScopes( aclId, { "editorUserId": ctx.user.id } );
        }

        async API_addUser ( ctx, aclId, userId, { enabled, scopes } = {} ) {
            if ( ctx.user.id === userId ) return result( [400, `You are unable to delete yourself`] );

            return this.api.acl.setAclUserScopes( aclId, userId, { enabled, scopes, "editorUserId": ctx.user.id } );
        }

        async API_deleteUser ( ctx, aclId, userId ) {
            if ( ctx.user.id === userId ) return result( [400, `You are unable to delete yourself`] );

            return this.api.acl.deleteAclUser( aclId, userId );
        }

        async API_setUserEnabled ( ctx, aclId, userId, enabled ) {
            if ( ctx.user.id === userId ) return result( [400, `You are unable to edit yourself`] );

            return this.api.acl.setAclUserEnabled( aclId, userId, enabled );
        }

        async API_setAclUserScopeEnabled ( ctx, aclId, userId, scope, enabled ) {
            if ( ctx.user.id === userId ) return result( [400, `You are unable to change own scope`] );

            return this.api.acl.setAclUserScopeEnabled( aclId, userId, scope, enabled, ctx.user.id );
        }

        async API_suggestUsers ( ctx, options ) {
            return this.api.acl.suggestAclUsers( options.where.acl_id[1], options.where.email?.[1] );
        }
    };
