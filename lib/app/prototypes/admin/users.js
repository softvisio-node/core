import mixins from "#lib/mixins";
import Base from "../base.js";
import Read from "../mixins/read.js";
import CONST from "#lib/const";
import sql from "#lib/sql";

export default class extends mixins( Read, Base ) {
    readRoot = false;

    async API_read ( ctx, args = {} ) {
        var where = this.dbh.where();

        // get by id
        if ( args.id ) {
            where.and( sql`"user"."id" = ${args.id}` );
        }

        // get all matched rows
        else {

            // filter root user
            if ( !this.readRoot ) {
                where.and( sql`"user"."id" != ${CONST.ROOT_USER_ID}` );
            }

            // filter search
            if ( args.where && args.where.search ) {
                where.and( { "user.name": args.where.search }, "OR", { "user.email": args.where.search }, "OR", { "user.telegram_name": args.where.search } );

                delete args.where.search;
            }
        }

        const totalQuery = sql`SELECT COUNT(*) AS "total" FROM "user"`.WHERE( where );

        const mainQuery = sql`
                    SELECT
                        *,
                        CASE
                            WHEN "user"."gravatar" IS NOT NULL
                            THEN 'https://s.gravatar.com/avatar/' || "user"."gravatar" || ${"?d=" + this.api.defaultGravatarImage}
                            ELSE ${this.api.defaultGravatarUrl}
                        END "avatar"
                    FROM
                        "user"
                    `.WHERE( where );

        return this._read( ctx, totalQuery, mainQuery, args );
    }

    async API_create ( ctx, fields ) {
        var { username, password, enabled, permissions } = fields;

        if ( enabled == null ) enabled = this.api.newUserEnabled;

        delete fields.username;
        delete fields.password;
        delete fields.enabled;
        delete fields.permissions;

        // check permissions
        if ( !ctx.isRoot && permissions ) {
            if ( !ctx.hasPermissions( Object.keys( permissions ) ) ) return result( [400, "Permissions are invalid"] );
        }

        return this.api.createUser( username, password, enabled, permissions, fields );
    }

    async API_delete ( ctx, userId ) {

        // user can't remove itself
        if ( userId === ctx.userId ) return result( [400, `You can't remove yourself`] );

        return this.api.removeUser( userId );
    }

    async API_set_enabled ( ctx, userId, enabled ) {

        // user can't disable itself
        if ( userId === ctx.userId || userId === ctx.username ) return result( [400, `You can't change own enabled status`] );

        return this.api.setUserEnabled( userId, enabled );
    }

    async API_set_password ( ctx, userId, password ) {

        // user can't set root password
        if ( this.api.userIsRoot( userId ) && !ctx.isRoot ) return result( [400, `You can't change root user password`] );

        return this.api.setUserPassword( userId, password );
    }

    async API_get_permissions ( ctx, userId ) {
        var permissions = await this.api.getUserPermissions( userId, ctx.permissions );

        if ( !permissions.ok ) return permissions;

        return permissions;
    }

    async API_set_permissions ( ctx, userId, permissions ) {

        // unable to modify own permissions
        if ( userId === ctx.userId ) return result( [400, "You are unable to change own permissions"] );

        // unable to modify root permissions
        if ( this.api.userIsRoot( userId ) ) return result( [400, "You are unable to change root user permissions"] );

        // check permissions
        if ( !ctx.isRoot ) {
            for ( const permission in permissions ) {
                if ( !ctx.permissions[permission] ) return result( [400, "Permissions are invalid"] );
            }
        }

        // set permissions
        return this.api.setUserPermissions( userId, permissions );
    }

    async API_update_permissions ( ctx, userId, permissions ) {

        // unable to modify own permissions
        if ( userId === ctx.userId ) return result( [400, "You are unable to change own permissions"] );

        // unable to modify root permissions
        if ( this.api.userIsRoot( userId ) ) return result( [400, "You are unable to change root user permissions"] );

        // check permissions
        if ( !ctx.isRoot ) {
            for ( const permission in permissions ) {
                if ( !ctx.permissions[permission] ) return result( [400, "Permissions are invalid"] );
            }
        }

        // set permissions
        return this.api.updateUserPermissions( userId, permissions );
    }

    async API_suggest ( ctx, args ) {
        var where;

        if ( args && args.where && args.where.name ) {
            where = this.dbh.where( { "name": ["LIKE", args.where.name[1]] }, "OR", { "email": ["LIKE", args.where.name[1]] }, "OR", { "telegram_name": ["LIKE", args.where.name[1]] } );
        }

        return this.dbh.select( sql`SELECT "id", "name" FROM "user"`.WHERE( where ).ORDER_BY( "name" ).LIMIT( 100 ) );
    }

    async API_set_username ( ctx, userId, username, password ) {
        return await this.api.setUserName( userId, username, password );
    }

    async API_delete_sessions ( ctx, userId ) {
        return this.api.removeUserSessions( userId, { "except": ctx.id } );
    }
}
