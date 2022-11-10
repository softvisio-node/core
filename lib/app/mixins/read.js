export default Super =>
    class extends ( Super || Object ) {
        async _read ( ctx, query, { options, summaryQuery, dbh } = {} ) {
            dbh ||= this.dbh;

            return dbh.read( query, {
                "id": options.id,
                summaryQuery,
                "offset": options.offset,
                "limit": options.limit,
                "orderBy": options.order_by ?? ctx?.method.readDefaultOrderBy,
                ...ctx.method.readLimit,
            } );
        }
    };
