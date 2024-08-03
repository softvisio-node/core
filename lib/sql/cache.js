import { Sql, Query } from "./query.js";
import uuid from "#lib/uuid";

class CachedQuery extends Sql {
    #id;
    #readOnly;
    #decode;

    constructor ( query, { id, readOnly, decode } = {} ) {
        super( query );

        this.#id = id || uuid();
        this.#readOnly = readOnly;
        this.#decode = decode;
    }

    // properties
    get id () {
        return this.#id;
    }

    get isReadOnly () {
        return this.#readOnly;
    }

    get types () {
        return this.#decode;
    }

    // public
    readOnly ( value ) {
        this.#readOnly = !!value;

        return this;
    }
}

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
            cachedQuery = new CachedQuery( query );

            this.#cache[ query ] = cachedQuery;
        }

        return cachedQuery;
    }
}

export default new SqlCache();
