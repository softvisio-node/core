import sql from "#lib/sql";

export default sql`

CREATE OR REPLACE FUNCTION user_before_insert_trigger() RETURNS TRIGGER AS $$
BEGIN

    -- check, that name is unique in email column
    IF EXISTS ( SELECT FROM "user" WHERE email = NEW.name ) THEN
        RAISE EXCEPTION 'Email is not unique' USING ERRCODE = 'unique_violation';
    END IF;

    -- check, that email is unique in name column
    IF NEW.email IS NOT NULL AND EXISTS ( SELECT FROM "user" WHERE name = NEW.email ) THEN
        RAISE EXCEPTION 'Email is not unique' USING ERRCODE = 'unique_violation';
    END IF;

    NEW.email_confirmed = FALSE;
    NEW.gravatar = md5 ( lower ( NEW.email ) );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION user_name_before_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    -- check, that "name" is unique in "email" column
    IF EXISTS ( SELECT FROM "user" WHERE email = NEW.name AND id != NEW.id ) THEN
        RAISE EXCEPTION 'Email is not unique' USING ERRCODE = 'unique_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION user_email_before_update_trigger() RETURNS TRIGGER AS $$
BEGIN
    -- check, that "email" is unique in "name" column
    IF NEW.email IS NOT NULL AND EXISTS ( SELECT FROM "user" WHERE name = NEW.email AND id != NEW.id ) THEN
        RAISE EXCEPTION 'Email is not unique' USING ERRCODE = 'unique_violation';
    END IF;

    DELETE FROM user_action_token WHERE email = OLD.email;

    NEW.email_confirmed = FALSE;
    NEW.gravatar = md5 ( lower ( NEW.email ) );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

`;
