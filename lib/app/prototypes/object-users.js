import mixins from "#lib/mixins";
import Base from "./base.js";

export default class extends mixins( Base ) {
    async API_getObjectUsers ( ctx, objectId ) {
        if ( !( await this.api.isObjectUserCanEditRoles( objectId, ctx.userId ) ) ) return result( [500, `You have no permissions to edit roles`] );

        const roles = this.api.getObjectRoles( objectId ),
            users = await this.api.getObjectUsers( objectId );

        if ( !users.ok ) return users;

        return result( 200, { "roles": roles.data, "users": users.data } );
    }

    async API_setObjectUserRole ( ctx, objectId, userId, role ) {
        if ( !( await this.api.isObjectUserCanEditRoles( objectId, ctx.userId ) ) ) return result( [500, `You have no permissions to edit roles`] );

        if ( ctx.userId === userId ) return result( [400, `You are unable to change own role`] );

        return this.api.setObjectUserRole( objectId, userId, role );
    }

    async API_deleteObjectUser ( ctx, objectId, userId ) {
        if ( !( await this.api.isObjectUserCanEditRoles( objectId, ctx.userId ) ) ) return result( [500, `You have no permissions to edit roles`] );

        if ( ctx.userId === userId ) return result( [400, `You are unable to delete yourself`] );

        return this.api.deleteObjectUser( objectId, userId );
    }
}
