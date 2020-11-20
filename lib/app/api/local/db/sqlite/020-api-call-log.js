const sql = require( "@softvisio/core/sql" );

module.exports = sql`

CREATE TABLE "api_call_log" (
    "method_id" TEXT NOT NULL,
    "api_version" TEXT NOT NULL,
    "api_namespace" TEXT NOT NULL,
    "method_name" TEXT NOT NULL,
    "user_id" INT4 REFERENCES "user" ("id") ON DELETE RESTRICT,
    "started" TIMESTAMPTZ NOT NULL,
    "finished" TIMESTAMP NOT NULL,
    "runtime" INT4 NOT NULL,
    "is_declined" BOOL NOT NULL,
    "is_error" BOOL NOT NULL,
    "is_exception" BOOL NOT NULL,
    "status" INT2 NOT NULL,
    "reason" TEXT NOT NULL
);

`;
