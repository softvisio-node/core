import sql from "#lib/sql";

export default Super =>
    class extends ( Super || Object ) {

        // XXX how to correctly fetch record by id???
        async _read ( ctx, mainQuery, { options, summaryQuery, dbh } = {} ) {

            // get by id
            // XXX how to correctly fetch record by id???
            if ( options.id ) return this.dbh.selectRow( mainQuery );

            const { offset, limit, maxResultsLimit } = sql.calcOffsetLimit( options.offset, options.limit, ctx.method.readLimit );

            // nothing to fetch
            if ( limit === 0 ) return result( 200, null, { "next_page": false } );

            dbh ||= this.dbh;

            var summary, totalRows;

            // has summary query
            if ( summaryQuery ) {
                summary = await dbh.selectRow( summaryQuery.decode( { "total": "int53" } ) );

                // summary query error
                if ( !summary.ok ) return summary;

                summary = summary.data;

                // has total count of rows
                if ( "total" in summary ) {

                    // no results
                    if ( !totalRows ) {
                        return result( 200, null, {
                            "total_rows": 0,
                            "next_page": false,
                            summary,
                        } );
                    }

                    // do not perform main query if offset >= total rows
                    else if ( offset && offset >= totalRows ) {
                        return result( 200, null, {
                            "total_rows": summary.total,
                            "next_page": false,
                            summary,
                        } );
                    }
                }
            }

            // add 1 row to the limit if:
            // we don't know total number of rows
            // we don't request all results
            var addLimit = false;
            if ( totalRows == null && limit && !maxResultsLimit ) addLimit = true;

            // execute main query
            const res = await dbh.select( mainQuery
                .ORDER_BY( options.order_by ?? ctx?.method.readDefaultOrderBy )
                .OFFSET( offset )
                .LIMIT( addLimit ? limit + 1 : limit ) );

            if ( res.ok ) {
                if ( summary ) res.meta.summary = summary;

                // we know total number of the rows
                if ( totalRows != null ) {
                    res.meta.total_rows = totalRows;
                    res.meta.next_page = offset + res.meta.rows < totalRows;
                }

                // we added 1 row to the limit
                else if ( addLimit ) {

                    // number of the returned rows > number of the requested rows
                    if ( res.meta.rows > limit ) {
                        res.meta.next_page = true;

                        // decrement results
                        res.data.pop();
                        res.meta.rows--;
                    }
                    else {
                        res.meta.next_page = false;
                    }
                }

                // we requested max. allowed number of the rows
                else {
                    res.meta.next_page = false;
                }
            }

            return res;
        }
    };
