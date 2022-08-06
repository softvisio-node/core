import mixins from "#lib/mixins";
import Base from "./base.js";
import sql from "#lib/sql";

export default class extends mixins( Base ) {
    async API_getUsers ( ctx, objectId ) {
        return this.api.getObjectUsers( objectId, { "parentUserId": ctx.userId } );
    }

    async API_getRoles ( ctx, objectId ) {
        return this.api.getObjectRoles( objectId, { "parentUserId": ctx.userId } );
    }

    async API_add ( ctx, objectId, userId, { roles, enabled } = {} ) {
        if ( ctx.userId === userId ) return result( [400, `You are unable to delete yourself`] );

        return this.api.setObjectUserRoles( objectId, userId, { enabled, roles, "parentUserId": ctx.userId } );
    }

    async API_delete ( ctx, objectId, userId ) {
        if ( ctx.userId === userId ) return result( [400, `You are unable to delete yourself`] );

        return this.api.deleteObjectUser( objectId, userId );
    }

    async API_setEnabled ( ctx, objectId, userId, enabled ) {
        if ( ctx.userId === userId ) return result( [400, `You are unable to edit yourself`] );

        return this.api.setObjectUserEnabled( objectId, userId, enabled );
    }

    async API_addRole ( ctx, objectId, userId, role ) {
        if ( ctx.userId === userId ) return result( [400, `You are unable to change own role`] );

        return this.api.addObjectUserRole( objectId, userId, role, { "parentUserId": ctx.userId } );
    }

    async API_deleteRole ( ctx, objectId, userId, role ) {
        if ( ctx.userId === userId ) return result( [400, `You are unable to change own role`] );

        return this.api.deleteObjectUserRole( objectId, userId, role, { "parentUserId": ctx.userId } );
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
    AND "user".id NOT IN ( SELECT user_id FROM object_user WHERE object_id = ${options.where.object_id[1]} )
LIMIT
    20
` );
    }
}
