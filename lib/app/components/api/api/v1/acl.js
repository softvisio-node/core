import mixins from "#lib/mixins";

export default Super =>
    class extends mixins( Super ) {
        async API_readAclUsers ( ctx, options ) {
            return this.api.acl.readAclUsers( options.where.acl_id[1], {
                "fields": options.where,
                "orderBy": options.order_by ?? ctx?.method.readDefaultOrderBy,
                "offset": options.offset,
                "limit": options.limit,
                ...ctx.method.readLimit,
            } );
        }

        async API_suggestAclUsers ( ctx, options ) {
            return this.api.acl.suggestAclUsers( options.where.acl_id[1], options.where.email?.[1] );
        }

        async API_addAclUser ( ctx, aclId, userId, { enabled, scopes } = {} ) {
            return this.api.acl.addAclUser( aclId, userId, { enabled, scopes, "parentUserId": ctx.user.id } );
        }

        async API_deleteAclUser ( ctx, aclId, userId ) {
            return this.api.acl.deleteAclUser( aclId, userId, { "parentUserId": ctx.user.id } );
        }

        async API_setAclUserEnabled ( ctx, aclId, userId, enabled ) {
            return this.api.acl.setAclUserEnabled( aclId, userId, enabled, { "parentUserId": ctx.user.id } );
        }

        async API_setAclUserScopes ( ctx, aclId, userId, scopes ) {
            return this.api.acl.setAclUserScopes( aclId, userId, scopes, { "parentUserId": ctx.user.id } );
        }

        async API_addAclUserScopes ( ctx, aclId, userId, scopes ) {
            return this.api.acl.addAclUserScopes( aclId, userId, scopes, { "parentUserId": ctx.user.id } );
        }

        async API_deleteAclUserScopes ( ctx, aclId, userId, scopes ) {
            return this.api.acl.deleteAclUserScopes( aclId, userId, scopes, { "parentUserId": ctx.user.id } );
        }

        async API_getAclUserScopes ( ctx, aclId, userId ) {
            return this.api.acl.getAclUserScopes( aclId, userId, { "parentUserId": ctx.user.id } );
        }

        async API_getAclUserPermissions ( ctx, aclId ) {
            if ( ctx.isRoot ) return result( 200 );

            const permissions = await this.api.acl.getAclUserPermissions( aclId, ctx.user.id );

            if ( !permissions ) {
                return result( [400, `Unable to get ACL user permissions`] );
            }
            else {
                return result( 200, permissions );
            }
        }

        async API_getAclScopes ( ctx, aclId ) {
            return this.api.acl.getAclScopes( aclId );
        }
    };
