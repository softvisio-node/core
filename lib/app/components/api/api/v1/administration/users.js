import constants from "#lib/app/constants";
import sql from "#lib/sql";

export default Super =>
    class extends Super {
        async API_getUsersList ( ctx, options = {} ) {
            const from = [ "user" ];

            var where = sql.where();

            // get by id
            if ( options.id ) {
                where.and( sql`"user"."id" = ${ options.id }` );
            }

            // get all matched rows
            else {

                // filter root user
                where.and( sql`"user"."id" != ${ constants.rootUserId }` );

                // filter search
                if ( options.where?.search ) {
                    where.and( { "user.email": options.where.search } );
                }
            }

            // filter roles
            if ( options.where?.roles ) {
                from.push( "acl_user_role" );

                where.and( sql`
acl_user_role.acl_id = ${ constants.mainAclId } AND acl_user_role.user_id = "user".id
AND acl_user_role.acl_role_id IN (
    SELECT
        acl_role.id
    FROM
        acl_role,
        acl
    WHERE
        acl_role.enabled
        AND acl_role.role`.IN( options.where.roles[ 1 ] ).sql`
        AND acl.acl_type_id = acl_role.acl_type_id
        AND acl.id = ${ constants.mainAclId }
)
` );
            }

            const query = sql`
WITH cte AS (
    SELECT DISTINCT
        "user".id
`
                .FROM( from )
                .WHERE( where ).sql`
)
SELECT
    "user".id,
    "user".created,
    "user".last_activity,
    "user".enabled,
    "user".email,
    "user".email_confirmed,
    ${ this.api.config.avatarUrl } || "user".id AS avatar_url,
    acl_user_roles( ${ constants.mainAclId }, "user".id ) AS roles
FROM
    cte,
    "user"
WHERE
    "user".id = cte.id
`;

            return this._read( ctx, query, { options } );
        }

        async API_createUser ( ctx, email, { password, enabled, roles } = {} ) {
            return this.api.users.createUser( email, {
                password,
                enabled,
                roles,
                "parentUserId": ctx.user.id,
            } );
        }

        async API_delete ( ctx, userId ) {

            // user can't remove itself
            if ( userId === ctx.user.id ) return result( [ 400, `You can't delete yourself` ] );

            return this.app.users.deleteUser( userId );
        }

        async API_setEnabled ( ctx, userId, enabled ) {

            // user can't disable itself
            if ( userId === ctx.user.id ) return result( [ 400, `You can't change own enabled status` ] );

            return this.app.users.setUserEnabled( userId, enabled );
        }

        async API_setPassword ( ctx, userId, password ) {

            // user can't set root password
            if ( this.app.userIsRoot( userId ) && !ctx.user.isRoot ) return result( [ 400, `You can't change root user password` ] );

            return this.app.users.setUserPassword( userId, password );
        }

        async API_getSessions ( ctx, userId ) {
            return this.api.sessions.getSessions( userId, { "currentSessionId": ctx.token?.id } );
        }

        async API_signOutSession ( ctx, userId, sessionId ) {

            // user can't set root password
            if ( this.app.userIsRoot( userId ) && !ctx.user.isRoot ) return result( [ 400, `You can't manage root user sessions` ] );

            return await this.api.sessions.deleteSession( sessionId, { userId } );
        }

        async API_signOutAllSessions ( ctx, userId ) {

            // user can't set root password
            if ( this.app.userIsRoot( userId ) && !ctx.user.isRoot ) return result( [ 400, `You can't manage root user sessions` ] );

            return this.api.sessions.deleteSessions( userId, { "excludeSessionId": ctx.token?.id } );
        }
    };
