import mixins from "#lib/mixins";
import Read from "../../mixins/read.js";
import constants from "#lib/app/constants";
import sql from "#lib/sql";

export default Super =>
    class extends mixins( Read, Super ) {
        async API_read ( ctx, options = {} ) {
            var where = this.dbh.where();

            // get by id
            if ( options.id ) {
                where.and( sql`"user"."id" = ${options.id}` );
            }

            // get all matched rows
            else {

                // filter root user
                where.and( sql`"user"."id" != ${constants.rootUserId}` );

                // filter search
                if ( options.where?.search ) {
                    where.and( { "user.email": options.where.search }, "OR", { "user.telegram_username": options.where.search } );
                }
            }

            // filter roles
            if ( options.where?.roles ) {
                where.and( options.where.roles[1].map( role => `"user".roles ->> ${this.dbh.quote( role )} = 'true'` ).join( " OR " ) );
            }

            const mainQuery = sql`
                    SELECT
                        *,
                        'https://s.gravatar.com/avatar/' || "user".gravatar || ${"?d=" + this.app.config.defaultGravatarEncoded} AS avatar
                    FROM
                        "user"
                    `.WHERE( where );

            return this._read( ctx, mainQuery, { options } );
        }

        async API_create ( ctx, fields ) {
            const email = fields.email;
            delete fields.email;

            fields.enabled ??= this.app.config.newUserEnabled;

            // check roles
            if ( !ctx.isRoot && fields.roles ) {
                if ( !ctx.hasRoles( Object.keys( fields.roles ) ) ) return result( [400, "Roles are invalid"] );
            }

            return this.api.createUser( email, fields );
        }

        async API_delete ( ctx, userId ) {

            // user can't remove itself
            if ( userId === ctx.userId ) return result( [400, `You can't delete yourself`] );

            return this.api.deleteUser( userId );
        }

        async API_setEnabled ( ctx, userId, enabled ) {

            // user can't disable itself
            if ( userId === ctx.userId ) return result( [400, `You can't change own enabled status`] );

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
            if ( this.api.userIsRoot( userId ) ) return result( [400, "Unable to change root user roles"] );

            // check roles
            if ( !ctx.isRoot ) {
                for ( const role in roles ) {
                    if ( !ctx.roles.has( role ) ) return result( [400, "Roles are invalid"] );
                }
            }

            // set roles
            return this.api.setUserRoles( userId, roles );
        }

        async API_updateRoles ( ctx, userId, roles ) {

            // unable to modify own roles
            if ( userId === ctx.userId ) return result( [400, "You are unable to change own roles"] );

            // unable to modify root roles
            if ( this.api.userIsRoot( userId ) ) return result( [400, "Unable to change root user roles"] );

            // check roles
            if ( !ctx.isRoot ) {
                for ( const role in roles ) {
                    if ( !ctx.roles.has( role ) ) return result( [400, "Roles are invalid"] );
                }
            }

            // set roles
            return this.api.updateUserRoles( userId, roles );
        }

        async API_getSessions ( ctx, userId ) {
            return this.api.getUserSessions( userId, { "currentSessionId": ctx.id } );
        }

        async API_signoutSession ( ctx, userId, sessionId ) {

            // user can't set root password
            if ( this.api.userIsRoot( userId ) && !ctx.isRoot ) return result( [400, `You can't manage root user sessions`] );

            return await this.api.deleteUserSession( sessionId, { userId } );
        }

        async API_signoutAllSessions ( ctx, userId ) {

            // user can't set root password
            if ( this.api.userIsRoot( userId ) && !ctx.isRoot ) return result( [400, `You can't manage root user sessions`] );

            return this.api.deleteUserSessions( userId, { "excludeSessionId": ctx.id } );
        }
    };
