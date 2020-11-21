const { mixin } = require( "../../../mixins" );
const sql = require( "../../../sql" );

// const TIMEOUT = 30000;

const QUERIES = {
    "logApiCall": sql`INSERT INTO "api_call_log" ("method_id", "api_version", "api_namespace", "method_name", "user_id", "started", "finished", "runtime", "is_declined", "is_error", "is_exception", "status", "reason") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`.prepare(),
};

module.exports = mixin( Super =>
    class extends Super {
            #cache = {};

            async logApiCall ( data ) {

                // this.#cache.push();

                this.dbh.do( QUERIES.logApiCall, [

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
                ] );
            }
    } );
