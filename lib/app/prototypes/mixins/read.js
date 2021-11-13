import sql from "#lib/sql";

export default Super =>
    class extends ( Super || Object ) {
        async _read ( ctx, mainQuery, { options, summaryQuery } = {} ) {

            // get by id
            // XXX how to correctly fetch record by id???
            if ( options.id ) return this.dbh.selectRow( mainQuery );

            const { offset, limit } = sql.calcOffsetLimit( options.offset, options.limit, ctx.method.readOffsetLimit );

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
                .ORDER_BY( options.order_by ?? ctx?.method.readDefaultOrderBy )
                .OFFSET( offset )
                .LIMIT( limit ) );

            if ( main.ok ) {
                if ( summary ) main.meta.summary = summary;

                // total from summary
                main.meta.total = total;
            }

            return main;
        }
    };
