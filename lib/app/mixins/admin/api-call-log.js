const { mixin, mix } = require( "../../../mixins" );
const sql = require( "../../../sql" );
const util = require( "../../../util" );
const Read = require( "../read" );

const UPDATE_INTERVAL_60_MIN = 10000;
const UPDATE_INTERVAL_30_DAYS = 60000;

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

            #lastUpdated = {};
            #cache = {};

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

            /** method: API_read_stat_60_min
             * summary: Read statistics for the last 60 minutes.
             * description: Statistics updated every 10 seconds.
             */
            async API_read_stat_60_min ( auth ) {
                return this._getStat( "60_min", UPDATE_INTERVAL_60_MIN );
            }

            /** method: API_read_stat_30_days
             * summary: Read statistics for the last 30 days.
             * description: Statistics updated every 1 minute.
             */
            async API_read_stat_30_days ( auth ) {
                return this._getStat( "30_days", UPDATE_INTERVAL_30_DAYS );
            }

            async _getStat ( type, interval ) {
                const methods = this.api.getLogMethods();

                // no methods to return
                if ( util.isEmptyObject( methods ) ) return result( 200 );

                if ( !this.#cache[type] || !this.#lastUpdated[type] || new Date() - this.#lastUpdated[type] > interval ) {
                    let res = await this.dbh.do( `REFRESH MATERIALIZED VIEW CONCURRENTLY "api_call_log_stat_${type}"` );

                    // dbh error
                    if ( !res.ok ) return res;

                    res = await this.dbh.selectAll( `SELECT "method_id" AS "id", "last_updated", "load", "requests" FROM "api_call_log_stat_${type}"` );

                    // dbh error
                    if ( !res.ok ) return res;

                    this.#lastUpdated[type] = new Date();

                    const idx = !res.data ? {} : Object.fromEntries( res.data.map( row => [row.id, row] ) ),
                        stat = this.api.stat,
                        data = [];

                    for ( const methodId in methods ) {
                        const row = idx[methodId] || { "id": methodId };

                        row.active_requests_limit = methods[methodId].activeRequestsLimit || null;
                        row.active_requests_user_limit = methods[methodId].activeRequestsUserLimit || null;
                        row.total_active_requests = ( stat[methodId] || {} ).total || 0;

                        data.push( row );
                    }

                    this.#cache[type] = data;
                }

                return result( 200, this.#cache[type] );
            }
    } );
