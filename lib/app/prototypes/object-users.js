import mixins from "#lib/mixins";
import Base from "./base.js";
import sql from "#lib/sql";

export default class extends mixins( Base ) {
    async API_getObjectUsers ( ctx, objectId ) {
        const roles = await this.api.getObjectRoles( objectId ),
            users = await this.api.getObjectUsers( objectId );

        if ( !users.ok ) return users;

        return result( 200, { "roles": roles.data, "users": users.data } );
    }

    async API_setObjectUserRole ( ctx, objectId, userId, roleId ) {
        if ( ctx.userId === userId ) return result( [400, `You are unable to change own role`] );

        return this.api.setObjectUserRole( objectId, userId, roleId );
    }

    async API_deleteObjectUser ( ctx, objectId, userId ) {
        if ( ctx.userId === userId ) return result( [400, `You are unable to delete yourself`] );

        return this.api.deleteObjectUser( objectId, userId );
    }

    // XXX exclude already assigned users
    async API_suggestUsers ( ctx, options ) {
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
`
            .WHERE( options.where )
            .LIMIT( 20 ) );
    }
}
