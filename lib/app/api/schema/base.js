export default class {
    #api;

    constructor ( api ) {
        this.#api = api;
    }

    // propertirs
    get app () {
        return this.#api.app;
    }

    get api () {
        return this.#api;
    }

    get dbh () {
        return this.#api.app.dbh;
    }

    // protected
    async _read ( ctx, query, { options, summaryQuery, dbh } = {} ) {
        dbh ||= this.dbh;

        return dbh.read( query, {
            summaryQuery,
            "orderBy": options.order_by ?? ctx?.method.readDefaultOrderBy,
            "offset": options.offset,
            "limit": options.limit,
            ...ctx.method.readLimit,
        } );
    }
}
