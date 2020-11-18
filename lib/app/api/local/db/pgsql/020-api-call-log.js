const sql = require( "@softvisio/core/sql" );

module.exports = sql`

CREATE TABLE "api_call_log" (
    "method_id" TEXT NOT NULL,
    "api_version" TEXT NOT NULL,
    "api_namespace" TEXT NOT NULL,
    "method_name" TEXT NOT NULL,
    "user_id" INT4,
    "connect_type" INT2 NOT NULL,
    "started" TIMESTAMPTZ NOT NULL,
    "delay" INT4,
    "is_error" BOOL,
    "status" INT2,
    "reason" TEXT
);

`;
