const result = require( "../../result" );

module.exports = Super =>

    /** class: Read
     * summary: API read helper.
     */
    class extends ( Super || Object ) {
        readMaxLimit;
        readDefaultLimit;
        readDefaultOrderBy;

        async _read ( totalQuery, mainQuery, args = {} ) {

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
            const data = await this.dbh.selectAll( mainQuery //
                .ORDER_BY( args.order_by || this.readDefaultOrderBy )
                .LIMIT( args.limit, { "max": this.readMaxLimit, "default": this.readDefaulLimit } )
                .OFFSET( args.offset ) );

            if ( data.ok && total ) {
                data.total = totalCount;
                data.summary = total.data;
            }

            return data;
        }
    };
