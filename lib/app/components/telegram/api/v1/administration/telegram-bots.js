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
                    where.and( { "user.email": options.where.search }, "OR" );
                }
            }

            // filter roles
            if ( options.where?.roles ) {
                from.push( "acl_user_role" );

                where.and( sql`
acl_user_role.acl_id = ${constants.defaultAclId} AND acl_user_role.user_id = "user".id
AND acl_user_role.acl_role_id IN (
    SELECT
        acl_role.id
    FROM
        acl_role,
        acl
    WHERE
        acl_role.enabled
        AND acl_role.role`.IN( options.where.roles[1] ).sql`
        AND acl.acl_type_id = acl_role.acl_type_id
        AND acl.id = ${constants.defaultAclId}
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
    'https://s.gravatar.com/avatar/' || "user".gravatar || ${"?d=" + this.api.config.defaultGravatarEncoded} AS avatar,
    acl_user_roles( ${constants.defaultAclId}, "user".id ) AS roles
FROM
    cte,
    "user"
WHERE
    "user".id = cte.id
`;

            return this._read( ctx, query, { options } );
        }
    };
