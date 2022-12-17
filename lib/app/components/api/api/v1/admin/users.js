import constants from "#lib/app/constants";
import sql from "#lib/sql";

export default Super =>
    class extends Super {
        async API_read ( ctx, options = {} ) {
            const from = ["user"];

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

            // filter scopes
            if ( options.where?.scopes ) {
                from.push( "acl_user_scope" );

                where.and( sql`
acl_user_scope.acl_id = -1 AND acl_user_scope.user_id = "user".id
AND acl_user_scope.acl_scope_id IN (
    SELECT
        acl_scope.id
    FROM
        acl_scope,
        acl
    WHERE
        acl_scope.enabled
        AND acl_scope.scope`.IN( options.where.scopes[1] ).sql`
        AND acl.acl_type_id = acl_scope.acl_type_id
        AND acl.id = -1
)
` );
            }

            const query = sql`
WITH cte AS (
    SELECT DISTINCT
        "user".id,
        "user".created,
        "user".last_activity,
        "user".enabled,
        "user".email,
        "user".email_confirmed,
        "user".telegram_username,
        'https://s.gravatar.com/avatar/' || "user".gravatar || ${"?d=" + this.api.config.defaultGravatarEncoded} AS avatar
`
                .FROM( from )
                .WHERE( where ).sql`
)
SELECT
    cte.*,
    acl_user_scopes( -1, cte.id ) AS scopes
FROM
    cte
`;

            return this._read( ctx, query, { options } );
        }

        async API_create ( ctx, fields ) {
            const email = fields.email;
            delete fields.email;

            fields.enabled ??= this.api.config.newUserEnabled;

            return this.api.user.createUser( email, fields );
        }

        async API_delete ( ctx, userId ) {

            // user can't remove itself
            if ( userId === ctx.user.id ) return result( [400, `You can't delete yourself`] );

            return this.api.user.deleteUser( userId );
        }

        async API_setEnabled ( ctx, userId, enabled ) {

            // user can't disable itself
            if ( userId === ctx.user.id ) return result( [400, `You can't change own enabled status`] );

            return this.api.user.setUserEnabled( userId, enabled );
        }

        async API_setPassword ( ctx, userId, password ) {

            // user can't set root password
            if ( this.api.validate.userIsRoot( userId ) && !ctx.user.isRoot ) return result( [400, `You can't change root user password`] );

            return this.api.user.setUserPassword( userId, password );
        }

        async API_getSessions ( ctx, userId ) {
            return this.api.userSessions.getUserSessions( userId, { "currentSessionId": ctx.token.id } );
        }

        async API_signoutSession ( ctx, userId, sessionId ) {

            // user can't set root password
            if ( this.api.validate.userIsRoot( userId ) && !ctx.user.isRoot ) return result( [400, `You can't manage root user sessions`] );

            return await this.api.userSessions.deleteUserSession( sessionId, { userId } );
        }

        async API_signoutAllSessions ( ctx, userId ) {

            // user can't set root password
            if ( this.api.validate.userIsRoot( userId ) && !ctx.user.isRoot ) return result( [400, `You can't manage root user sessions`] );

            return this.api.userSessions.deleteUserSessions( userId, { "excludeSessionId": ctx.token.id } );
        }
    };
