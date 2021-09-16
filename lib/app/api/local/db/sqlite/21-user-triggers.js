import sql from "#lib/sql";

export default sql`

CREATE TRIGGER "user_before_insert_trigger" BEFORE INSERT ON "user"
BEGIN
    -- check, that "name" is unique in "email" column
    SELECT
        CASE WHEN
            EXISTS (SELECT 1 FROM "user" WHERE "email" = NEW."name")
        THEN
            RAISE(ABORT, 'Email is not unique.')
        END;

    -- check, that "email" is unique in "name" column
    SELECT
        CASE WHEN
            NEW."email" IS NOT NULL
        THEN
            CASE WHEN
                EXISTS (SELECT 1 FROM "user" WHERE "name" = NEW."email")
            THEN
                RAISE(ABORT, 'Email is not unique.')
            END
        END;
END;

CREATE TRIGGER "user_after_insert_trigger" AFTER INSERT ON "user"
BEGIN
    UPDATE "user" SET "email_confirmed" = FALSE, "gravatar" = md5(lower(NEW."email")) WHERE "id" = NEW."id";
END;

CREATE TRIGGER "user_name_before_update_trigger" BEFORE UPDATE OF "name" ON "user"
BEGIN
    -- check, that "name" is unique in "email" column
    SELECT CASE WHEN
        EXISTS (SELECT 1 FROM "user" WHERE "email" = NEW."name" AND "id" != NEW."id")
    THEN
        RAISE(ABORT, 'Email is not unique.')
    END;
END;

CREATE TRIGGER "user_email_before_update_trigger" BEFORE UPDATE OF "email" ON "user"
WHEN NEW."email" IS NOT NULL
BEGIN
    -- check, that "email" is unique in "name" column
    SELECT CASE WHEN
        EXISTS (SELECT 1 FROM "user" WHERE "name" = NEW."email" AND "id" != NEW."id")
    THEN
        RAISE(ABORT, 'Email is not unique.')
    END;
END;

CREATE TRIGGER "user_email_after_update_trigger" AFTER UPDATE OF "email" ON "user"
BEGIN
    DELETE FROM "user_action_token" WHERE "email" = OLD."email";

    UPDATE "user" SET "email_confirmed" = FALSE, "gravatar" = md5(lower(NEW."email")) WHERE "id" = NEW."id";
END;

CREATE TRIGGER "user_name_permissions_after_update_trigger" AFTER UPDATE OF "name", "permissions" ON "user"
BEGIN
    SELECT sqlite_notify('api/invalidate-user', OLD."id");
END;

CREATE TRIGGER "user_disabled_trigger" AFTER UPDATE OF "enabled" ON "user"
WHEN (NEW."enabled" = FALSE)
BEGIN

    -- drop user sessions
    DELETE FROM "user_session" WHERE "user_id" = OLD."id";

    SELECT sqlite_notify('api/invalidate-user', OLD."id");
END;

CREATE TRIGGER "user_after_delete_trigger" AFTER DELETE ON "user"
BEGIN
    SELECT sqlite_notify('api/invalidate-user', OLD."id");
END;

CREATE TRIGGER "user_hash_hash_after_update_trigger" AFTER UPDATE OF "hash" ON "user_hash"
BEGIN
    SELECT sqlite_notify('api/invalidate-user', OLD."user_id");
END;

`;
