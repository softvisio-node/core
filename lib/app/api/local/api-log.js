const { mixin } = require( "../../../mixins" );

const INTERVAL = 10000;

const QUERY = `INSERT INTO "api_call_log" ("method_id", "api_version", "api_namespace", "method_name", "user_id", "started", "finished", "runtime", "is_declined", "is_error", "is_exception", "status", "reason") VALUES `;

const ROW_TEMPLATE = `(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

module.exports = mixin( Super =>
    class extends Super {
            #interval;
            #cache = [];

            async init ( options = {} ) {
                if ( INTERVAL ) this.#interval = setInterval( () => this._dropCache(), INTERVAL );

                if ( super.init ) return await super.init( options );

                return result( 200 );
            }

            async logApiCall ( data ) {
                const row = [

                    //
                    data.methodId,
                    data.apiVersion,
                    data.apiNamespace,
                    data.methodName,
                    data.userId,
                    data.started.toISOString(),
                    data.finished.toISOString(),
                    data.runtime,
                    data.isDeclined,
                    data.isError,
                    data.isException,
                    data.status,
                    data.reason,
                ];

                this.#cache.push( row );

                if ( !INTERVAL ) this._dropCache();
            }

            async _dropCache () {
                if ( this.#cache.length ) {
                    let query = QUERY,
                        comma = "";

                    const params = [];

                    for ( const row of this.#cache ) {
                        params.push( ...row );

                        query += comma + ROW_TEMPLATE;

                        comma = ", ";
                    }

                    this.#cache = [];

                    this.dbh.do( query, params );
                }
            }
    } );
