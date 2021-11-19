import sql from "#lib/sql";

export default Super =>
    class extends ( Super || Object ) {

        // XXX how to correctly fetch record by id???
        async _read ( ctx, mainQuery, { options, summaryQuery, dbh } = {} ) {

            // get by id
            // XXX how to correctly fetch record by id???
            if ( options.id ) return this.dbh.selectRow( mainQuery );

            const { offset, limit } = sql.calcOffsetLimit( options.offset, options.limit, ctx.method.readLimit );

            // do nothing if max results limit is exceeded
            if ( limit < 0 ) return result( 200, null, { "next_page": false } );

            dbh ||= this.dbh;

            var summary, totalRows;

            // has summary query
            if ( summaryQuery ) {
                summary = await dbh.selectRow( summaryQuery );

                // summary query error
                if ( !summary.ok ) return summary;

                summary = summary.data;

                // has total count of rows
                if ( "total" in summary ) {
                    totalRows = BigInt( summary.total );

                    // no results
                    if ( !totalRows ) {
                        return result( 200, null, {
                            "total": summary.total,
                            "next_page": false,
                            summary,
                        } );
                    }

                    // do not perform main query if offset >= total rows
                    else if ( offset && BigInt( offset ) >= totalRows ) {
                        return result( 200, null, {
                            "total": summary.total,
                            "next_page": false,
                            summary,
                        } );
                    }

                    totalRows = summary.total;
                }
            }

            // execute main query
            const main = await dbh.select( mainQuery
                .ORDER_BY( options.order_by ?? ctx?.method.readDefaultOrderBy )
                .OFFSET( offset )
                .LIMIT( limit ) );

            if ( main.ok ) {
                if ( summary ) main.meta.summary = summary;

                const returnedRows = offset + main.meta.rows;

                // total from summary
                if ( totalRows != null ) {
                    main.meta.total = totalRows;

                    main.meta.next = returnedRows < totalRows;
                }

                // dynamic next
                else {

                    // rows fetched with limit
                    if ( limit ) {

                        // number of fetched rows === limit, next page is POSSIBLY available, we don't know on 100%
                        main.meta.next = main.meta.rows === limit;

                        const maxResults = ctx.method.readLimit.maxResults;

                        // if number of returned results === max. results - no next page available
                        if ( maxResults && returnedRows >= maxResults ) main.meta.next = false;
                    }

                    // all rows fetched without limit, no next page is available
                    else main.meta.next = false;
                }
            }

            return main;
        }
    };
