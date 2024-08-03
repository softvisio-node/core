import { sql, Query } from "./query.js";

class SqlCache {
    #cache = {};

    // public
    get ( query ) {
        if ( query instanceof Query ) {
            query = query.query;
        }
        else if ( typeof query !== "string" ) {
            throw Error( `Invalid SQL query` );
        }

        var cachedQuery = this.#cache[ query ];

        if ( !cachedQuery ) {
            cachedQuery = sql( query ).prepare();

            this.#cache[ query ] = cachedQuery;
        }

        return cachedQuery;
    }
}

export default new SqlCache();
