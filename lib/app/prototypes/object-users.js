import mixins from "#lib/mixins";
import Base from "./base.js";
import sql from "#lib/sql";

export default class extends mixins( Base ) {
    async API_getObjectUsers ( ctx, objectId ) {
        if ( !ctx.isRoot && !( await this.api.isObjectUserCanEditRoles( objectId, ctx.userId ) ) ) return result( [500, `You have no permissions to edit roles`] );

        const roles = this.api.getObjectRoles( objectId ),
            users = await this.api.getObjectUsers( objectId );

        if ( !users.ok ) return users;

        return result( 200, { "roles": roles.data, "users": users.data } );
    }

    async API_setObjectUserRole ( ctx, objectId, userId, roleId ) {
        if ( ctx.userId === userId ) return result( [400, `You are unable to change own role`] );

        if ( !ctx.isRoot && !( await this.api.isObjectUserCanEditRoles( objectId, ctx.userId ) ) ) return result( [500, `You have no permissions to edit roles`] );

        return this.api.setObjectUserRole( objectId, userId, roleId );
    }

    async API_deleteObjectUser ( ctx, objectId, userId ) {
        if ( ctx.userId === userId ) return result( [400, `You are unable to delete yourself`] );

        if ( !ctx.isRoot && !( await this.api.isObjectUserCanEditRoles( objectId, ctx.userId ) ) ) return result( [500, `You have no permissions to edit roles`] );

        return this.api.deleteObjectUser( objectId, userId );
    }

    async API_suggestUsers ( ctx, options ) {
        const search = options?.where?.name?.[1] ? "%" + options?.where?.name?.[1] + "%" : "%";

        return this.dbh.select( sql`
SELECT
    id,
    name,
    CASE
        WHEN "user".gravatar IS NOT NULL
        THEN 'https://s.gravatar.com/avatar/' || "user".gravatar || ?
        ELSE ?
    END avatar
FROM
    "user"
WHERE
    name LIKE ?
LIMIT 20
`,
        ["?d=" + this.app.defaultGravatarImage, this.app.defaultGravatarUrl, search] );
    }
}
