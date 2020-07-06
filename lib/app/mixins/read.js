const { mixin } = require( "../../mixins" );
const result = require( "../../result" );

module.exports = mixin( ( Super ) =>

/** class: Read
         */
    class extends Super {
            readMaxLimit;
            readDefaultLimit;
            readDefaultOrderBy;

            #api;
            #dbh;

            constructor ( app, api, options ) {
                super( app, api, options );

                this.#api = api;
                this.#dbh = options.dbh;
            }

            async _read ( totalQuery, mainQuery, args = {} ) {

                // get by id
                if ( args.id ) return this.#dbh.selectRow( mainQuery );

                var total, totalCount;

                if ( totalQuery ) {
                    total = await this.#dbh.selectRow( totalQuery );

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
                const data = await this.#dbh.selectAll( mainQuery //
                    .ORDER_BY( args.order_by || this.readDefaultOrderBy )
                    .LIMIT( args.limit, { "max": this.readMaxLimit, "default": this.readDefaulLimit } )
                    .OFFSET( args.offset ) );

                if ( data.ok && total ) {
                    data.total = totalCount;
                    data.summary = total.data;
                }

                return data;
            }
    } );
