const { mixin, mix } = require( "../../../mixins" );
const sql = require( "../../../sql" );
const Read = require( "../read" );

module.exports = mixin( Super =>

/** class: ApiCallLog
         * summary: App API call log.
         * permissions:
         *   - admin
         */
    class extends mix( Read, Super ) {
            readRoot = false;
            readMaxLimit = 100;
            readDefaultOrderBy = [["name", "DESC"]];

            // XXX
            /** method: API_read_entries
             * summary: Read users.
             * params:
             *   - name: options
             *     schema:
             *       type: object
             *       properties:
             *         id: { type: integer }
             *         where:
             *           type: object
             *           properties:
             *             search:
             *               type: array
             *           additionalProperties: false
             *         order_by:
             *           type: array
             *         limit: { type: integer }
             *         offset: { type: integer }
             *       additionalProperties: false
             */
            async API_read_entries ( auth, args = {} ) {
                var where = this.dbh.WHERE();

                // get by id
                if ( args.id ) {
                    where.and( sql`"user"."id" = ${args.id}` );
                }

                // get all matched rows
                else {

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
        WHEN "user"."gravatar" IS NOT NULL THEN 'https://s.gravatar.com/avatar/' || "user"."gravatar" || ${"?d=" + this.api.defaultGravatarImage}
        ELSE ${this.api.defaultGravatarUrl}
    END "avatar"
FROM
    "user"
                    `.WHERE( where );

                return this._read( totalQuery, mainQuery, args );
            }

            /** method: API_read_totals
             * summary: Read totals statistics.
             */
            async API_read_totals ( auth ) {
                const res = await this.dbh.selectAll( sql`
                    WITH
                        "stat" AS (
                            SELECT
                                "method_id",
                                TIME_BUCKET_GAPFILL(INTERVAL '1 minute', "started") AS "date",
                                COUNT(NULLIF("is_declined", TRUE)) AS "total_accepted_requests",
                                COUNT(NULLIF("is_declined", FALSE)) AS "total_declined_requests",
                                (AVG(runtime) / 1000)::DECIMAL(10, 2) AS "avg_runtime"
                            FROM
                                "api_call_log"
                            WHERE
                                "started" > NOW() - INTERVAL '24 hours'
                                AND "started" <= NOW()
                            GROUP BY
                                "method_id",
                                "date"
                            ORDER BY
                                "date"
                        ),
                        "methods" AS (
                            SELECT DISTINCT "method_id" FROM "api_call_log"
                        )
                    SELECT
                        "methods"."method_id" AS "id",
                        (    SELECT JSON_AGG(JSON_BUILD_OBJECT(
                                'date', "date",
                                'total_accepted_requests', "total_accepted_requests",
                                'total_declined_requests', "total_declined_requests",
                                'avg_runtime', "avg_runtime"
                            ))
                            FROM
                                "stat"
                            WHERE
                                "method_id" = "methods"."method_id"
                        ) AS "stat"
                    FROM
                        "methods"
                ` );

                if ( !res.ok || !res.data ) return res;

                res.data.forEach( row => {
                    const methodSpec = this.api.getMethod( row.id );

                    row.max_running_requests = methodSpec.maxRunningRequests || null;
                    row.max_running_requests_user = methodSpec.maxRunningRequestsUser || null;
                } );

                return res;
            }
    } );
