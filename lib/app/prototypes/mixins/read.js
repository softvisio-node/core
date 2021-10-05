export default Super =>
    class extends ( Super || Object ) {
        async _read ( ctx, totalQuery, mainQuery, args = {} ) {

            // get by id
            if ( args.id ) return this.dbh.selectRow( mainQuery );

            var total, totalCount;

            if ( totalQuery ) {
                total = await this.dbh.selectRow( totalQuery );

                // total query error
                if ( !total.ok ) return total;

                totalCount = total.data.total;

                // no results
                if ( !totalCount ) {
                    return result( 200, null, {
                        "total": totalCount,
                        "summary": total.data,
                    } );
                }

                // do not perform main query if offset >= total
                else if ( args.offset && args.offset >= totalCount ) {
                    return result( 200, null, {
                        "total": totalCount,
                        "summary": total.data,
                    } );
                }
            }

            // has results
            const data = await this.dbh.select( mainQuery //
                .ORDER_BY( args.order_by ?? ctx?.method.meta.readDefaultOrderBy )
                .LIMIT( args.limit, { "max": ctx?.method.meta.readMaxLimit, "default": ctx?.method.meta.readDefaultLimit } )
                .OFFSET( args.offset ) );

            if ( data.ok && total ) {
                data.meta.total = totalCount;
                data.meta.summary = total.data;
            }

            return data;
        }
    };
