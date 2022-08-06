import mixins from "#lib/mixins";
import Base from "../base.js";
import Read from "../mixins/read.js";
import constants from "#lib/app/constants";
import sql from "#lib/sql";

export default class extends mixins( Read, Base ) {
    readRoot = false;

    async API_read ( ctx, options = {} ) {
        var where = this.dbh.where();

        // get by id
        if ( options.id ) {
            where.and( sql`"user"."id" = ${options.id}` );
        }

        // get all matched rows
        else {

            // filter root user
            if ( !this.readRoot ) {
                where.and( sql`"user"."id" != ${constants.rootUserId}` );
            }

            // filter search
            if ( options.where?.search ) {
                where.and( { "user.name": options.where.search }, "OR", { "user.email": options.where.search }, "OR", { "user.telegram_username": options.where.search } );

                delete options.where.search;
            }
        }

        const mainQuery = sql`
                    SELECT
                        *,
                        CASE
                            WHEN "user".gravatar IS NOT NULL
                            THEN 'https://s.gravatar.com/avatar/' || "user".gravatar || ${"?d=" + this.app.config.defaultGravatarImage}
                            ELSE ${this.app.config.defaultGravatarUrl}
                        END avatar
                    FROM
                        "user"
                    `.WHERE( where );

        return this._read( ctx, mainQuery, { options } );
    }

    async API_create ( ctx, fields ) {
        var { username, password, enabled, roles } = fields;

        if ( enabled == null ) enabled = this.app.config.newUserEnabled;

        delete fields.username;
        delete fields.password;
        delete fields.enabled;
        delete fields.roles;

        // check roles
        if ( !ctx.isRoot && roles ) {
            if ( !ctx.hasRoles( Object.keys( roles ) ) ) return result( [400, "Roles are invalid"] );
        }

        return this.api.createUser( username, password, enabled, roles, fields );
    }

    async API_delete ( ctx, userId ) {

        // user can't remove itself
        if ( userId === ctx.userId ) return result( [400, `You can't remove yourself`] );

        return this.api.removeUser( userId );
    }

    async API_setEnabled ( ctx, userId, enabled ) {

        // user can't disable itself
        if ( userId === ctx.userId || userId === ctx.username ) return result( [400, `You can't change own enabled status`] );

        return this.api.setUserEnabled( userId, enabled );
    }

    async API_setPassword ( ctx, userId, password ) {

        // user can't set root password
        if ( this.api.userIsRoot( userId ) && !ctx.isRoot ) return result( [400, `You can't change root user password`] );

        return this.api.setUserPassword( userId, password );
    }

    async API_getRoles ( ctx, userId ) {
        var roles = await this.api.getUserRoles( userId, ctx.roles );

        if ( !roles.ok ) return roles;

        return roles;
    }

    async API_setRoles ( ctx, userId, roles ) {

        // unable to modify own roles
        if ( userId === ctx.userId ) return result( [400, "You are unable to change own roles"] );

        // unable to modify root roles
        if ( this.api.userIsRoot( userId ) ) return result( [400, "You are unable to change root user roles"] );

        // check roles
        if ( !ctx.isRoot ) {
            for ( const role in roles ) {
                if ( !ctx.roles[role] ) return result( [400, "Roles are invalid"] );
            }
        }

        // set roles
        return this.api.setUserRoles( userId, roles );
    }

    async API_updateRoles ( ctx, userId, roles ) {

        // unable to modify own roles
        if ( userId === ctx.userId ) return result( [400, "You are unable to change own roles"] );

        // unable to modify root roles
        if ( this.api.userIsRoot( userId ) ) return result( [400, "You are unable to change root user roles"] );

        // check roles
        if ( !ctx.isRoot ) {
            for ( const role in roles ) {
                if ( !ctx.roles[role] ) return result( [400, "Roles are invalid"] );
            }
        }

        // set roles
        return this.api.updateUserRoles( userId, roles );
    }

    async API_setUsername ( ctx, userId, username, password ) {
        return await this.api.setUserName( userId, username, password );
    }

    async API_deleteSessions ( ctx, userId ) {
        return this.api.removeUserSessions( userId, { "except": ctx.id } );
    }
}
