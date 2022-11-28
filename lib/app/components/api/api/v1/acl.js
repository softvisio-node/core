import mixins from "#lib/mixins";
import sql from "#lib/sql";
import constants from "#lib/app/constants";

const QUERIES = {
    "suggestUsers": sql`
SELECT
    id,
    email,
    'https://s.gravatar.com/avatar/' || "user".gravatar || ? AS avatar
FROM
    "user"
WHERE
    "user".email ILIKE ?
    AND "user".id != ?
    AND "user".id NOT IN ( SELECT user_id FROM acl_user WHERE acl_id = ? )
LIMIT
    20
`,
};

export default Super =>
    class extends mixins( Super ) {
        async API_getAclPermissions ( ctx, aclId ) {
            return this.api.acl.getAclUserPermissions( aclId, ctx.user.id );
        }

        async API_getUsers ( ctx, aclId ) {
            return this.api.acl.getAclUsers( aclId, { "editorUserId": ctx.user.id } );
        }

        async API_getRoles ( ctx, aclId ) {
            return this.api.acl.getAclRoles( aclId, { "editorUserId": ctx.user.id } );
        }

        async API_addUser ( ctx, aclId, userId, { roles, enabled } = {} ) {
            if ( ctx.user.id === userId ) return result( [400, `You are unable to delete yourself`] );

            return this.api.acl.setAclUserRoles( aclId, userId, { enabled, roles, "editorUserId": ctx.user.id } );
        }

        async API_deleteUser ( ctx, aclId, userId ) {
            if ( ctx.user.id === userId ) return result( [400, `You are unable to delete yourself`] );

            return this.api.acl.deleteAclUser( aclId, userId );
        }

        async API_setUserEnabled ( ctx, aclId, userId, enabled ) {
            if ( ctx.user.id === userId ) return result( [400, `You are unable to edit yourself`] );

            return this.api.acl.setAclUserEnabled( aclId, userId, enabled );
        }

        async API_setRoleEnabled ( ctx, aclId, userId, role, enabled ) {
            if ( ctx.user.id === userId ) return result( [400, `You are unable to change own role`] );

            return this.api.acl.setAclUserRoleEnabled( aclId, userId, role, enabled, { "editorUserId": ctx.user.id } );
        }

        async API_suggestUsers ( ctx, options ) {
            const query = options.where.email?.[1] ? `%${options.where.email?.[1]}%` : "%";

            return this.dbh.select( QUERIES.suggestUsers, [

                //
                "?d=" + this.api.config.defaultGravatarEncoded,
                query,
                constants.rootUserId,
                options.where.acl_id[1],
            ] );
        }
    };
