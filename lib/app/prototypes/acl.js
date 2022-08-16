import mixins from "#lib/mixins";
import Base from "./base.js";
import sql from "#lib/sql";

export default class extends mixins( Base ) {
    async API_getUsers ( ctx, aclId ) {
        return this.api.getAclUsers( aclId, { "parentUserId": ctx.userId } );
    }

    async API_getRoles ( ctx, aclId ) {
        return this.api.getAclRoles( aclId, { "parentUserId": ctx.userId } );
    }

    async API_addUser ( ctx, aclId, userId, { roles, enabled } = {} ) {
        if ( ctx.userId === userId ) return result( [400, `You are unable to delete yourself`] );

        return this.api.setAclUserRoles( aclId, userId, { enabled, roles, "parentUserId": ctx.userId } );
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

        return this.api.setAclUserRoleEnabled( aclId, userId, role, enabled, { "parentUserId": ctx.userId } );
    }

    async API_suggestUsers ( ctx, options ) {
        const q = options.where.name?.[1] ? `%${options.where.name?.[1]}%` : "%";

        return this.dbh.select( sql`
SELECT
    id,
    name,
    CASE WHEN "user".gravatar IS NOT NULL
        THEN 'https://s.gravatar.com/avatar/' || "user".gravatar || ${"?d=" + this.app.config.defaultGravatarImage}
        ELSE ${this.app.config.defaultGravatarUrl}
    END AS avatar
FROM
    "user"
WHERE
    "user".name ILIKE ${q}
    AND "user".id != 1
    AND "user".id NOT IN ( SELECT user_id FROM acl_user WHERE acl_id = ${options.where.acl_id[1]} )
LIMIT
    20
` );
    }
}
