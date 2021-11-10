import sql from "#lib/sql";

export default Super =>
    class extends ( Super || Object ) {
        async _read ( ctx, summaryQuery, mainQuery, options = {} ) {

            // get by id
            // XXX
            if ( options.id ) return this.dbh.selectRow( mainQuery );

            const { offset, limit } = sql.calcOffsetLimit( options.offset, options.limit, {
                "maxResults": ctx.method.meta.readMaxResults,
                "defaultLimit": ctx.method.meta.readDefaultLimit,
                "maxLimit": ctx.method.meta.readMaxLimit,
            } );

            // do nothing if max results limit is exceeded
            if ( limit < 0 ) return result( 200 );

            var summary, total;

            // has summary query
            if ( summaryQuery ) {
                summary = await this.dbh.selectRow( summaryQuery );

                // summary query error
                if ( !summary.ok ) return summary;

                summary = summary.data;

                // has total count of rows
                if ( total in summary ) {
                    total = BigInt( summary.total );

                    // no results
                    if ( !total ) {
                        return result( 200, null, {
                            "total": summary.total,
                            summary,
                        } );
                    }

                    // do not perform main query if offset >= total rows
                    else if ( offset && BigInt( offset ) >= total ) {
                        return result( 200, null, {
                            "total": summary.total,
                            summary,
                        } );
                    }

                    total = summary.total;
                }
            }

            // execute main query
            const main = await this.dbh.select( mainQuery
                .ORDER_BY( options.order_by ?? ctx?.method.meta.readDefaultOrderBy )
                .OFFSET( offset )
                .LIMIT( limit ) );

            if ( main.ok ) {
                if ( summary ) main.meta.summary = summary;

                // total from summary
                if ( total != null ) {
                    main.meta.total = total;
                }

                // dynamic total
                else {
                    main.meta.total = offset + main.meta.rows;

                    if ( limit && main.meta.rows === limit ) main.meta.total += limit;

                    const maxResults = ctx.method.meta.readMaxResults;
                    if ( maxResults && main.meta.total > maxResults ) main.meta.total = maxResults;
                }
            }

            return main;
        }
    };
