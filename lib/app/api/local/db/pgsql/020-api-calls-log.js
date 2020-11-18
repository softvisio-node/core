const sql = require( "@softvisio/core/sql" );

module.exports = sql`

CREATE TABLE "api_calls_log" (
    "method_id" TEXT NOT NULL,
    "user_id" INT4,
    "started" TIMESTAMPTZ NOT NULL,
    "delay" INT4,
    "is_error" BOOL,
    "status" INT2,
    "reason" TEXT
);

`;
