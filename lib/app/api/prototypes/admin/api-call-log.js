import "#index";

import mixins from "#lib/mixins";
import sql from "#lib/sql";
import Base from "../../prototypes/base.js";
import Read from "../mixins/read.js";
import { objectIsEmpty } from "#lib/utils";

const TYPE_LATEST = "60_min";
const TYPE_HISTORY = "30_days";

const UPDATE_INTERVAL_LATEST = 10000;
const UPDATE_INTERVAL_HISTORY = 60000;

export default class extends mixins( Read, Base ) {
    #lastUpdated = {
        [TYPE_LATEST]: null,
        [TYPE_HISTORY]: null,
    };

    #cache = {
        [TYPE_LATEST]: {},
        [TYPE_HISTORY]: {},
    };

    async API_read_log ( ctx, args = {} ) {
        var where = this.dbh.WHERE();

        where.and( args.where );

        const totalQuery = sql`SELECT COUNT(*) AS "total" FROM "api_call_log"`.WHERE( where );

        const mainQuery = sql`SELECT * FROM "api_call_log" `.WHERE( where );

        return this._read( ctx, totalQuery, mainQuery, args );
    }

    async API_read_latest_stat ( ctx, method ) {
        return this._getStat( TYPE_LATEST, UPDATE_INTERVAL_LATEST, method );
    }

    async API_read_history_stat ( ctx, method ) {
        return this._getStat( TYPE_HISTORY, UPDATE_INTERVAL_HISTORY, method );
    }

    async _getStat ( type, interval, method ) {
        const methods = this.api.schema.getLogMethods();

        // no methods to return
        if ( objectIsEmpty( methods ) ) return result( 200 );

        if ( !method ) method = "";

        if ( !this.#cache[type][method] || !this.#lastUpdated[type] || new Date() - this.#lastUpdated[type] > interval ) {

            // refresh material view
            let res = await this.dbh.do( `REFRESH MATERIALIZED VIEW CONCURRENTLY "api_call_log_stat_${type}"` );

            // dbh error
            if ( !res.ok ) return res;

            var data = [];

            // get history
            if ( method ) {
                res = await this.dbh.selectRow( `SELECT "method_id" AS "id", "last_updated", "load", "requests" FROM "api_call_log_stat_${type}" WHERE "method_id" = ?`, [method] );

                // dbh error
                if ( !res.ok ) return res;

                data = res.data;
            }

            // get latet
            else {
                res = await this.dbh.select( `SELECT "method_id" AS "id", "last_updated", "load", "requests" FROM "api_call_log_stat_${type}"` );

                // dbh error
                if ( !res.ok ) return res;

                const idx = !res.data ? {} : Object.fromEntries( res.data.map( row => [row.id, row] ) ),
                    stat = this.api.stat;

                for ( const method in methods ) {
                    const row = idx[method] || { "id": method };

                    row.active_requests_limit = methods[method].activeRequestsLimit || null;
                    row.active_requests_user_limit = methods[method].activeRequestsUserLimit || null;
                    row.total_active_requests = ( stat[method] || {} ).total || 0;

                    data.push( row );
                }
            }

            this.#lastUpdated[type] = new Date();

            this.#cache[type][method] = data;
        }

        return result( 200, this.#cache[type][method] );
    }
}
