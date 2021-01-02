const sql = require( "@softvisio/core/sql" );

module.exports = sql`

CREATE TABLE "object_permissions" (
    "object_id" INT8 NOT NULL,
    "user_id" INT4 NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "enabled" BOOL NOT NULL DEFAULT TRUE,
    "permissions" JSONB NOT NULL,
    "created" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("object_id", "user_id")
);

`;
