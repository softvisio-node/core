import sql from "#lib.sql";

export default Super =>
    class extends ( Super || Object ) {
        async _read ( ctx, totalQuery, mainQuery, options = {} ) {
            const { offset, limit } = sql.calcOffsetLimit( options.offset, options.limit, {
                "maxResults": ctx?.method.meta.readMaxResults,
                "defaultLimit": ctx?.method.meta.readDefaultLimit,
                "maxLimit": ctx?.method.meta.readMaxLimit,
            } );

            // do nothing if max requests limit is exceeded
            if ( limit < 0 ) return result( 200 );

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
                .OFFSET( offset )
                .LIMIT( limit ) );

            if ( data.ok && total ) {
                data.meta.total = total.data.total;
                data.meta.summary = total.data;
            }

            return data;
        }
    };
