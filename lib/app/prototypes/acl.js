import mixins from "#lib/mixins";
import Base from "./base.js";
import sql from "#lib/sql";

export default class extends mixins( Base ) {
    async API_getUsers ( ctx, objectId ) {
        return this.api.getAclUsers( objectId, { "parentUserId": ctx.userId } );
    }

    async API_getRoles ( ctx, objectId ) {
        return this.api.getAclRoles( objectId, { "parentUserId": ctx.userId } );
    }

    async API_addUser ( ctx, objectId, userId, { roles, enabled } = {} ) {
        if ( ctx.userId === userId ) return result( [400, `You are unable to delete yourself`] );

        return this.api.setAclUserRoles( objectId, userId, { enabled, roles, "parentUserId": ctx.userId } );
    }

    async API_deleteUser ( ctx, objectId, userId ) {
        if ( ctx.userId === userId ) return result( [400, `You are unable to delete yourself`] );

        return this.api.deleteAclUser( objectId, userId );
    }

    async API_setUserEnabled ( ctx, objectId, userId, enabled ) {
        if ( ctx.userId === userId ) return result( [400, `You are unable to edit yourself`] );

        return this.api.setAclUserEnabled( objectId, userId, enabled );
    }

    async API_setRoleEnabled ( ctx, objectId, userId, role, enabled ) {
        if ( ctx.userId === userId ) return result( [400, `You are unable to change own role`] );

        return this.api.setAclUserRoleEnabled( objectId, userId, role, enabled, { "parentUserId": ctx.userId } );
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
    END avatar
FROM
    "user"
WHERE
    "user".name ILIKE ${q}
    AND "user".id != 1
    AND "user".id NOT IN ( SELECT user_id FROM acl WHERE object_id = ${options.where.object_id[1]} )
LIMIT
    20
` );
    }
}
