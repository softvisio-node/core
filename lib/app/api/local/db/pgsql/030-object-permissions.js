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

CREATE SEQUENCE IF NOT EXISTS "object_id_seq" AS INT8 INCREMENT BY 1 MINVALUE 1 MAXVALUE 36028797018963967 CACHE 10 NO CYCLE;

CREATE OR REPLACE FUNCTION generate_object_id(_type INTEGER) RETURNS INT8 VOLATILE STRICT AS $$
BEGIN
    RETURN (SELECT OVERLAY(nextval('object_id_seq')::bit(64) PLACING _type::bit(8) FROM 2)::int8);
END;
$$ LANGUAGE "plpgsql";

`;
