const { mixin } = require( "../../../mixins" );

const CLEANUP_INTERVAL = 30; // days
const CACHE_DROP_INTERVAL = 10000; // milliseconds

const LOAD_QUERY = `INSERT INTO "api_call_load" ("method_id", "user_id", "started", "is_declined") VALUES `;
const LOAD_ROW_TEMPLATE = `(?, ?, ?, ?)`;

const FINISHED_QUERY = `INSERT INTO "api_call_log" ("method_id", "user_id", "started", "finished", "runtime", "is_error", "is_exception", "status", "reason") VALUES `;
const FINISHED_ROW_TEMPLATE = `(?, ?, ?, ?, ?, ?, ?, ?, ?)`;

module.exports = mixin( Super =>
    class extends Super {
            #loadCache = [];
            #requestsCache = [];

            async $init ( options = {} ) {
                if ( CLEANUP_INTERVAL ) setInterval( async () => this.#cleanApiCallLog(), 1000 * 60 * 60 * 24 );

                if ( CACHE_DROP_INTERVAL ) setInterval( () => this.#dropApiCallLogCache(), CACHE_DROP_INTERVAL );

                var res = super.$init ? await super.$init( options ) : result( 200 );

                return res;
            }

            logApiCallLoad ( data ) {
                const row = [

                    //
                    data.methodId,
                    data.userId,
                    data.started.toISOString(),
                    data.isDeclined,
                ];

                this.#loadCache.push( row );

                if ( !CACHE_DROP_INTERVAL ) this.#dropApiCallLogCache();
            }

            logApiCall ( data ) {
                const row = [

                    //
                    data.methodId,
                    data.userId,
                    data.started.toISOString(),
                    data.finished.toISOString(),
                    data.runtime,
                    data.isError,
                    data.isException,
                    data.status,
                    data.reason,
                ];

                this.#requestsCache.push( row );

                if ( !CACHE_DROP_INTERVAL ) this.#dropApiCallLogCache();
            }

            async #cleanApiCallLog () {
                await this.dbh.do( `DELETE FROM "api_call_load" WHERE "started" < CURRENT_TIMESTAMP - ? * INTERVAL '1 DAY'`, [CLEANUP_INTERVAL] );

                await this.dbh.do( `DELETE FROM "api_call_log" WHERE "finished" < CURRENT_TIMESTAMP - ? * INTERVAL '1 DAY'`, [CLEANUP_INTERVAL] );
            }

            async #dropApiCallLogCache () {

                // log accepted requests
                if ( this.#loadCache.length ) {
                    let query = LOAD_QUERY,
                        separator = "";

                    const params = [];

                    for ( const row of this.#loadCache ) {
                        params.push( ...row );

                        query += separator + LOAD_ROW_TEMPLATE;

                        separator = ", ";
                    }

                    this.#loadCache = [];

                    await this.dbh.do( query, params );
                }

                // log finished requests
                if ( this.#requestsCache.length ) {
                    let query = FINISHED_QUERY,
                        separator = "";

                    const params = [];

                    for ( const row of this.#requestsCache ) {
                        params.push( ...row );

                        query += separator + FINISHED_ROW_TEMPLATE;

                        separator = ", ";
                    }

                    this.#requestsCache = [];

                    await this.dbh.do( query, params );
                }
            }
    } );
