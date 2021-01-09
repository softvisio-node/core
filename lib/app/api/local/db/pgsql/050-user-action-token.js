const sql = require( "@softvisio/core/sql" );

module.exports = sql`

CREATE TABLE "user_action_token" (
    "id" int8 PRIMARY KEY NOT NULL,
    "user_id" int8 NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "type" int2 NOT NULL,
    "email" text NOT NULL,
    "created" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE FUNCTION user_action_token_before_insert_trigger() RETURNS TRIGGER AS $$
BEGIN
    NEW."id" = gen_token_id(NEW."type");

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "user_action_token_before_insert_trigger" BEFORE INSERT ON "user_action_token" FOR EACH ROW EXECUTE PROCEDURE user_action_token_before_insert_trigger();

CREATE TRIGGER "user_action_token_after_delete_trigger" AFTER DELETE ON "user_action_token" FOR EACH ROW EXECUTE PROCEDURE user_hash_delete_trigger();

`;
