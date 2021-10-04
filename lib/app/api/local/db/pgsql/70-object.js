import sql from "#lib/sql";

export default sql`

CREATE TABLE "objectPermissions" (
    "objectId" int8 NOT NULL,
    "userId" int8 NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "created" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enabled" bool NOT NULL DEFAULT TRUE,
    "permissions" jsonb NOT NULL,
    PRIMARY KEY ("objectId", "userId")
);

CREATE SEQUENCE IF NOT EXISTS objectIdSeq AS int8 INCREMENT BY 1 MINVALUE 1 MAXVALUE 36028797018963967 NO CYCLE;

CREATE OR REPLACE FUNCTION gen_object_id ( _type integer ) RETURNS int8 VOLATILE STRICT AS $$
BEGIN
    RETURN (SELECT overlay(nextval(objectIdSeq)::bit(64) PLACING _type::bit(8) FROM 2)::int8);
END;
$$ LANGUAGE "plpgsql";

`;
