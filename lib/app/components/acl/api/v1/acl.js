import sql from "#lib/sql";

export default Super =>
    class extends Super {

        // public
        async [ "API_getAclUsersList" ] ( ctx, options ) {
            const from = [ "user", "acl_user" ];

            const where = sql.where( `
acl_user.acl_id = ${ options.where.acl_id[ 1 ] }
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
        AND acl_role.role`.IN( options.where.roles[ 1 ] ).sql`
        AND acl.acl_type_id = acl_role.acl_type_id
        AND acl.id = ${ options.where.acl_id[ 1 ] }
)
` );
            }

            const query = sql`
WITH cte AS (
    SELECT DISTINCT
        acl_user.user_id
`
                .FROM( from )
                .WHERE( where ).sql`
)
SELECT
    acl_user.user_id AS id,
    acl_user.acl_id AS acl_id,
    "user".email AS email,
    ${ this.api.config.avatarUrl } || "user".id AS avatar_url,
    acl_user.created,
    acl_user.enabled,
    acl_user_roles( acl_user.acl_id, acl_user.user_id ) as roles,
    acl_user_editable(
        _acl_id => acl_user.acl_id,
        _acl_user_id => acl_user.user_id,
        _parent_user_id => ${ ctx.user.id }
    ) AS editable
FROM
    cte,
    "user",
    acl_user
WHERE
    acl_user.acl_id = ${ options.where.acl_id[ 1 ] }
    AND acl_user.user_id = cte.user_id
    AND "user".id = acl_user.user_id

`;

            return this._read( ctx, query, { options } );
        }

        async [ "API_suggestAclUsers" ] ( ctx, options ) {
            return this.app.acl.suggestAclUsers( options.where.acl_id[ 1 ], options.where.email?.[ 1 ], ctx.user.id );
        }

        async [ "API_addAclUser" ] ( ctx, aclId, userId, { enabled, roles } = {} ) {
            return this.app.acl.addAclUser( aclId, userId, { enabled, roles, "parentUserId": ctx.user.id } );
        }

        async [ "API_deleteAclUser" ] ( ctx, aclId, userId ) {
            return this.app.acl.deleteAclUser( aclId, userId, { "parentUserId": ctx.user.id } );
        }

        async [ "API_setAclUserEnabled" ] ( ctx, aclId, userId, enabled ) {
            return this.app.acl.setAclUserEnabled( aclId, userId, enabled, { "parentUserId": ctx.user.id } );
        }

        async [ "API_setAclUserRoles" ] ( ctx, aclId, userId, roles ) {
            return this.app.acl.setAclUserRoles( aclId, userId, roles, { "parentUserId": ctx.user.id } );
        }

        async [ "API_addAclUserRoles" ] ( ctx, aclId, userId, roles ) {
            return this.app.acl.addAclUserRoles( aclId, userId, roles, { "parentUserId": ctx.user.id } );
        }

        async [ "API_deleteAclUserRoles" ] ( ctx, aclId, userId, roles ) {
            return this.app.acl.deleteAclUserRoles( aclId, userId, roles, { "parentUserId": ctx.user.id } );
        }

        async [ "API_getAclUserRoles" ] ( ctx, aclId, userId ) {
            return this.app.acl.getAclUserRoles( aclId, userId, { "parentUserId": ctx.user.id } );
        }

        async [ "API_getAclUserPermissions" ] ( ctx, aclId, userId ) {
            const permissions = await this.app.acl.getAclUserPermissions( aclId, userId || ctx.user.id );

            if ( !permissions ) {
                return result( [ 400, `Unable to get ACL user permissions` ] );
            }
            else {
                return result( 200, permissions );
            }
        }

        async [ "API_getAclRoles" ] ( ctx, aclId ) {
            return this.app.acl.getAclRoles( aclId );
        }
    };
