import sql from "#lib/sql";

export default sql`

CREATE TABLE user_action_token (
    id serial8 PRIMARY KEY,
    user_id int8 NOT NULL REFERENCES "user" ( id ) ON DELETE CASCADE,
    type int2 NOT NULL,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires timestamptz NOT NULL,
    data json,
    UNIQUE ( user_id, type )
);

CREATE TABLE user_action_token_hash (
    user_action_token_id int8 PRIMARY KEY REFERENCES user_action_token ( id ) ON DELETE CASCADE,
    fingerprint int2 NOT NULL,
    hash text NOT NULL
);

CREATE FUNCTION user_action_token_user_email_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    IF OLD.email != NEW.email THEN

        DELETE FROM user_action_token WHERE user_id = NEW.id;

    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_action_token_user_email_after_update AFTER UPDATE OF email ON "user" FOR EACH ROW EXECUTE FUNCTION user_action_token_user_email_after_update_trigger();

`;
