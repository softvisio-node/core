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

            if ( options.where.roles ) {
                from.push( "acl_user_role" );

                where.and( sql`
acl_user_role.acl_id = acl_user.acl_id AND acl_user_role.user_id = acl_user.user_id
AND acl_user_role.acl_role_id IN (
    SELECT
        acl_role.id
    FROM
        acl_role,
        acl
    WHERE
        acl_role.enabled
        AND acl_role.role`.IN( options.where.roles[1] ).sql`
        AND acl.acl_type_id = acl_role.acl_type_id
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
    acl_user_roles( cte.acl_id, cte.id ) as roles
FROM
    cte
`;

            return this._read( ctx, query, { options } );
        }

        async API_suggestAclUsers ( ctx, options ) {
            return this.api.acl.suggestAclUsers( options.where.acl_id[1], options.where.email?.[1] );
        }

        async API_addAclUser ( ctx, aclId, userId, { enabled, roles } = {} ) {
            return this.api.acl.addAclUser( aclId, userId, { enabled, roles, "parentUserId": ctx.user.id } );
        }

        async API_deleteAclUser ( ctx, aclId, userId ) {
            return this.api.acl.deleteAclUser( aclId, userId, { "parentUserId": ctx.user.id } );
        }

        async API_setAclUserEnabled ( ctx, aclId, userId, enabled ) {
            return this.api.acl.setAclUserEnabled( aclId, userId, enabled, { "parentUserId": ctx.user.id } );
        }

        async API_setAclUserRoles ( ctx, aclId, userId, roles ) {
            return this.api.acl.setAclUserRoles( aclId, userId, roles, { "parentUserId": ctx.user.id } );
        }

        async API_addAclUserRoles ( ctx, aclId, userId, roles ) {
            return this.api.acl.addAclUserRoles( aclId, userId, roles, { "parentUserId": ctx.user.id } );
        }

        async API_deleteAclUserRoles ( ctx, aclId, userId, roles ) {
            return this.api.acl.deleteAclUserRoles( aclId, userId, roles, { "parentUserId": ctx.user.id } );
        }

        async API_getAclUserRoles ( ctx, aclId, userId ) {
            return this.api.acl.getAclUserRoles( aclId, userId, { "parentUserId": ctx.user.id } );
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

        async API_getAclRoles ( ctx, aclId ) {
            return this.api.acl.getAclRoles( aclId );
        }
    };
