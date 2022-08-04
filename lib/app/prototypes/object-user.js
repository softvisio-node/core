import mixins from "#lib/mixins";
import Base from "./base.js";
import sql from "#lib/sql";

export default class extends mixins( Base ) {
    async API_getUsers ( ctx, objectId ) {
        const roles = await this.api.getObjectRoles( objectId ),
            users = await this.api.getObjectUsers( objectId );

        if ( !users.ok ) return users;

        return result( 200, { "roles": roles.data, "users": users.data } );
    }

    async API_setRole ( ctx, objectId, userId, roleId ) {
        if ( ctx.userId === userId ) return result( [400, `You are unable to change own role`] );

        return this.api.setObjectUserRole( objectId, userId, roleId );
    }

    async API_delete ( ctx, objectId, userId ) {
        if ( ctx.userId === userId ) return result( [400, `You are unable to delete yourself`] );

        return this.api.deleteObjectUser( objectId, userId );
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
