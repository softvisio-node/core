const { mixin, mix } = require( "../../../mixins" );
const sql = require( "../../../sql" );
const util = require( "../../../util" );
const Read = require( "../read" );

const TYPE_LATEST = "60_min";
const TYPE_HISTORY = "30_days";

const UPDATE_INTERVAL_LATEST = 10000;
const UPDATE_INTERVAL_HISTORY = 60000;

module.exports = mixin( Super =>

/** class: ApiCallLog
         * summary: App API call log.
         * permissions:
         *   - admin
         */
    class extends mix( Read, Super ) {
            readRoot = false;
            readMaxLimit = 100;
            readDefaultOrderBy = [["started", "DESC"]];

            #lastUpdated = {
                [TYPE_LATEST]: null,
                [TYPE_HISTORY]: null,
            };
            #cache = {
                [TYPE_LATEST]: {},
                [TYPE_HISTORY]: {},
            };

            /** method: API_read_log
             * summary: Read users.
             * params:
             *   - name: options
             *     schema:
             *       type: object
             *       properties:
             *         where:
             *           type: object
             *           properties:
             *             method_id:
             *               type: array
             *           required: [method_id]
             *           additionalProperties: false
             *         order_by:
             *           type: array
             *         limit: { type: integer }
             *         offset: { type: integer }
             *       additionalProperties: false
             */
            async API_read_log ( auth, args = {} ) {
                var where = this.dbh.WHERE();

                where.and( args.where );

                const totalQuery = sql`SELECT COUNT(*) AS "total" FROM "api_call_log"`.WHERE( where );

                const mainQuery = sql`SELECT * FROM "api_call_log" `.WHERE( where );

                return this._read( totalQuery, mainQuery, args );
            }

            /** method: API_read_latest_stat
             * summary: Read statistics for the last 60 minutes.
             * description: Statistics updated every 10 seconds. Data resolution is 1 minute.
             * params:
             *   - name: method_id
             *     schema:
             *       type: string
             */
            async API_read_latest_stat ( auth, methodId ) {
                return this._getStat( TYPE_LATEST, UPDATE_INTERVAL_LATEST, methodId );
            }

            /** method: API_read_history_stat
             * summary: Read statistics for the given API method for the last 30 days.
             * description: Statistics updated every 1 minute. Data resolution is 10 minutes.
             * params:
             *   - name: method_id
             *     required: true
             *     schema:
             *       type: string
             */
            async API_read_history_stat ( auth, methodId ) {
                return this._getStat( TYPE_HISTORY, UPDATE_INTERVAL_HISTORY, methodId );
            }

            async _getStat ( type, interval, methodId ) {
                const methods = this.api.getLogMethods();

                // no methods to return
                if ( util.isEmptyObject( methods ) ) return result( 200 );

                if ( !methodId ) methodId = "";

                if ( !this.#cache[type][methodId] || !this.#lastUpdated[type] || new Date() - this.#lastUpdated[type] > interval ) {

                    // refresh material view
                    let res = await this.dbh.do( `REFRESH MATERIALIZED VIEW CONCURRENTLY "api_call_log_stat_${type}"` );

                    // dbh error
                    if ( !res.ok ) return res;

                    var data = [];

                    // get history
                    if ( methodId ) {
                        res = await this.dbh.selectRow( `SELECT "method_id" AS "id", "last_updated", "load", "requests" FROM "api_call_log_stat_${type}" WHERE "method_id" = ?`, [methodId] );

                        // dbh error
                        if ( !res.ok ) return res;

                        data = res.data;
                    }

                    // get latet
                    else {
                        res = await this.dbh.selectAll( `SELECT "method_id" AS "id", "last_updated", "load", "requests" FROM "api_call_log_stat_${type}"` );

                        // dbh error
                        if ( !res.ok ) return res;

                        const idx = !res.data ? {} : Object.fromEntries( res.data.map( row => [row.id, row] ) ),
                            stat = this.api.stat;

                        for ( const methodId in methods ) {
                            const row = idx[methodId] || { "id": methodId };

                            row.active_requests_limit = methods[methodId].activeRequestsLimit || null;
                            row.active_requests_user_limit = methods[methodId].activeRequestsUserLimit || null;
                            row.total_active_requests = ( stat[methodId] || {} ).total || 0;

                            data.push( row );
                        }
                    }

                    this.#lastUpdated[type] = new Date();

                    this.#cache[type][methodId] = data;
                }

                return result( 200, this.#cache[type][methodId] );
            }
    } );
