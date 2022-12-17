import sql from "#lib/sql";

export default Super =>
    class extends Super {
        async API_readAclUsers ( ctx, options ) {
            const from = ["user", "acl_user"];

            const where = this.dbh.where( `
acl_user.acl_id = ${options.where.acl_id[1]}
AND acl_user.user_id = "user".id

` );

            if ( options.where.enabled ) {
                where.and( { "acl_user.enabled": options.where.enabled } );
            }

            if ( options.where.email ) {
                where.and( { '"user".email': options.where.email } );
            }

            if ( options.where.scopes ) {
                from.push( "acl_user_scope" );

                where.and( `
acl_user_scope.acl_id = acl_user.acl_id AND acl_user_scope.user_id = acl_user.user_id
AND acl_user_scope.acl_scope_id IN (
    SELECT
        acl_scope.id
    FROM
        acl_scope,
        acl
    WHERE
        acl_scope.enabled
        AND acl_scope.scope IN ( ${options.where.scopes[1].map( scope => this.dbh.quote( scope ) ).join( ", " )} )
        AND acl.acl_type_id = acl_scope.acl_type_id
        AND acl.id = ${options.where.acl_id[1]}
)
` );
            }

            const query = sql`
WITH cte AS (
    SELECT DISTINCT
        acl_user.user_id AS id,
        acl_user.acl_id AS acl_id,
        "user".email AS email,
        'https://s.gravatar.com/avatar/' || "user".gravatar || ${"?d=" + this.api.config.defaultGravatarEncoded} AS avatar,
        acl_user.created,
        acl_user.enabled
`
                .FROM( from )
                .WHERE( where ).sql`
)
SELECT
    cte.*,
    acl_user_scopes( cte.acl_id, cte.id ) as scopes
FROM
    cte
`;

            return this._read( ctx, query, { options } );
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
