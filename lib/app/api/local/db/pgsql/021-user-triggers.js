import sql from "#core/sql";

export default sql`

CREATE FUNCTION user_before_insert_trigger() RETURNS TRIGGER AS $$
BEGIN

    -- check, that "name" is unique in "email" column
    IF EXISTS (SELECT 1 FROM "user" WHERE "email" = NEW."name") THEN
        RAISE EXCEPTION 'Email is not unique.';
    END IF;

    -- check, that "email" is unique in "name" column
    IF NEW."email" IS NOT NULL AND EXISTS (SELECT 1 FROM "user" WHERE "name" = NEW."email") THEN
        RAISE EXCEPTION 'Email is not unique.';
    END IF;

    NEW."email_confirmed" = FALSE;
    NEW."gravatar" = md5(lower(NEW."email"));

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "user_before_insert_trigger" BEFORE INSERT ON "user" FOR EACH ROW EXECUTE PROCEDURE user_before_insert_trigger();

CREATE OR REPLACE FUNCTION user_name_before_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    -- check, that "name" is unique in "email" column
    IF EXISTS (SELECT 1 FROM "user" WHERE "email" = NEW."name" AND "id" != NEW."id") THEN
        RAISE EXCEPTION 'Email is not unique.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "user_name_before_update_trigger" BEFORE UPDATE OF "name" ON "user" FOR EACH ROW EXECUTE PROCEDURE user_name_before_update_trigger();

CREATE OR REPLACE FUNCTION user_email_before_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    -- check, that "email" is unique in "name" column
    IF NEW."email" IS NOT NULL AND EXISTS (SELECT 1 FROM "user" WHERE "name" = NEW."email" AND "id" != NEW."id") THEN
        RAISE EXCEPTION 'Email is not unique.';
    END IF;

    DELETE FROM "user_action_token" WHERE "email" = OLD."email";

    NEW."email_confirmed" = FALSE;
    NEW."gravatar" = md5(lower(NEW."email"));

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "user_email_before_update_trigger" BEFORE UPDATE OF "email" ON "user" FOR EACH ROW EXECUTE PROCEDURE user_email_before_update_trigger();

CREATE FUNCTION user_invalidate_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('api/invalidate-user', OLD."id"::text);

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "user_name_permissions_after_update_trigger" AFTER UPDATE OF "name", "permissions" ON "user" FOR EACH ROW EXECUTE PROCEDURE user_invalidate_trigger();

CREATE TRIGGER "user_enabled_after_update_trigger" AFTER UPDATE OF "enabled" ON "user" FOR EACH ROW WHEN (NEW."enabled" = FALSE) EXECUTE PROCEDURE user_invalidate_trigger();

CREATE TRIGGER "user_after_delete_trigger" AFTER DELETE ON "user" FOR EACH ROW EXECUTE PROCEDURE user_invalidate_trigger();

CREATE FUNCTION user_invalidate_hash_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('api/invalidate-user', OLD."user_id"::text);

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "user_hash_hash_after_update_trigger" AFTER UPDATE OF "hash" ON "user_hash" FOR EACH ROW EXECUTE PROCEDURE user_invalidate_hash_trigger();

`;
