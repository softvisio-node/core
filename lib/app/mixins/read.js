export default Super =>
    class extends ( Super || Object ) {
        async _read ( ctx, query, { options, summaryQuery, dbh } = {} ) {
            dbh ||= this.dbh;

            return dbh.read( query, {
                "id": options.id,
                summaryQuery,
                "orderBy": options.order_by ?? ctx?.method.readDefaultOrderBy,
                "offset": options.offset,
                "limit": options.limit,
                ...ctx.method.readLimit,
            } );
        }
    };
