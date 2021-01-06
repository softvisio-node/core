const sql = require( "@softvisio/core/sql" );

module.exports = sql`

INSERT OR IGNORE INTO "_sequence" ("name", "seq") VALUES ('object_id', 0);

CREATE TABLE "object_permissions" (
    "object_id" INT8 NOT NULL,
    "user_id" INT4 NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "created" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enabled" BOOL NOT NULL DEFAULT TRUE,
    "permissions" JSONB NOT NULL,
    PRIMARY KEY ("object_id", "user_id")
);

`;
