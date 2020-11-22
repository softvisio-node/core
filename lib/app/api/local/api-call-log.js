const { mixin } = require( "../../../mixins" );

const INTERVAL = 10000;

const LOAD_QUERY = `INSERT INTO "api_call_load" ("method_id", "user_id", "started", "is_declined") VALUES `;

const LOAD_ROW_TEMPLATE = `(?, ?, ?, ?)`;

const FINISHED_QUERY = `INSERT INTO "api_call_log" ("method_id", "user_id", "started", "finished", "runtime", "is_error", "is_exception", "status", "reason") VALUES `;

const FINISHED_ROW_TEMPLATE = `(?, ?, ?, ?, ?, ?, ?, ?, ?)`;

module.exports = mixin( Super =>
    class extends Super {
            #interval;
            #loadCache = [];
            #requestsCache = [];

            async init ( options = {} ) {
                if ( INTERVAL ) this.#interval = setInterval( () => this._dropApiCallLogCache(), INTERVAL );

                if ( super.init ) return await super.init( options );

                return result( 200 );
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

                if ( !INTERVAL ) this._dropApiCallLogCache();
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

                if ( !INTERVAL ) this._dropApiCallLogCache();
            }

            async _dropApiCallLogCache () {

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
