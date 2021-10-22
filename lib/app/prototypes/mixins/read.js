export default Super =>
    class extends ( Super || Object ) {
        async _read ( ctx, totalQuery, mainQuery, options = {} ) {

            // get by id
            if ( options.id ) return this.dbh.selectRow( mainQuery );

            var total, totalCount;

            if ( totalQuery ) {
                total = await this.dbh.selectRow( totalQuery );

                // total query error
                if ( !total.ok ) return total;

                totalCount = BigInt( total.data.total );

                // no results
                if ( !totalCount ) {
                    return result( 200, null, {
                        "total": total.data.total,
                        "summary": total.data,
                    } );
                }

                // do not perform main query if offset >= total
                else if ( options.offset && BigInt( options.offset ) >= totalCount ) {
                    return result( 200, null, {
                        "total": total.data.total,
                        "summary": total.data,
                    } );
                }
            }

            // has results
            const data = await this.dbh.select( mainQuery //
                .ORDER_BY( options.order_by ?? ctx?.method.meta.readDefaultOrderBy )
                .LIMIT( options.limit, { "max": ctx?.method.meta.readMaxLimit, "default": ctx?.method.meta.readDefaultLimit } )
                .OFFSET( options.offset ) );

            if ( data.ok && total ) {
                data.meta.total = total.data.total;
                data.meta.summary = total.data;
            }

            return data;
        }
    };
