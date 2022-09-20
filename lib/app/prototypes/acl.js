import mixins from "#lib/mixins";
import Base from "./base.js";
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

export default class extends mixins( Base ) {
    async API_getAclPermissions ( ctx, aclId, aclObjectType ) {
        return this.api.getAclPermissions( aclId, ctx.userId, aclObjectType );
    }

    async API_getUsers ( ctx, aclId ) {
        return this.api.getAclUsers( aclId, { "editorUserId": ctx.userId } );
    }

    async API_getRoles ( ctx, aclId ) {
        return this.api.getAclRoles( aclId, { "editorUserId": ctx.userId } );
    }

    async API_addUser ( ctx, aclId, userId, { roles, enabled } = {} ) {
        if ( ctx.userId === userId ) return result( [400, `You are unable to delete yourself`] );

        return this.api.setAclUserRoles( aclId, userId, { enabled, roles, "editorUserId": ctx.userId } );
    }

    async API_deleteUser ( ctx, aclId, userId ) {
        if ( ctx.userId === userId ) return result( [400, `You are unable to delete yourself`] );

        return this.api.deleteAclUser( aclId, userId );
    }

    async API_setUserEnabled ( ctx, aclId, userId, enabled ) {
        if ( ctx.userId === userId ) return result( [400, `You are unable to edit yourself`] );

        return this.api.setAclUserEnabled( aclId, userId, enabled );
    }

    async API_setRoleEnabled ( ctx, aclId, userId, role, enabled ) {
        if ( ctx.userId === userId ) return result( [400, `You are unable to change own role`] );

        return this.api.setAclUserRoleEnabled( aclId, userId, role, enabled, { "editorUserId": ctx.userId } );
    }

    async API_suggestUsers ( ctx, options ) {
        const query = options.where.email?.[1] ? `%${options.where.email?.[1]}%` : "%";

        return this.dbh.select( QUERIES.suggestUsers, [

            //
            "?d=" + this.app.config.defaultGravatarEncoded,
            query,
            constants.rootUserId,
            options.where.acl_id[1],
        ] );
    }
}
