import sql from "#lib/sql";

export default sql`

CREATE TABLE action_token (
    id serial8 PRIMARY KEY,
    user_id int8 NOT NULL REFERENCES "user" ( id ) ON DELETE CASCADE,
    type int2 NOT NULL,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires timestamptz NOT NULL,
    email_token bool NOT NULL DEFAULT FALSE,
    data json,
    UNIQUE ( user_id, type )
);

CREATE TABLE action_token_hash (
    action_token_id int8 PRIMARY KEY REFERENCES action_token ( id ) ON DELETE CASCADE,
    fingerprint int2 NOT NULL,
    hash text NOT NULL
);

-- delete email tokens on user email changed
CREATE FUNCTION action_token_user_email_after_update_trigger() RETURNS TRIGGER AS $$
BEGIN

    IF OLD.email != NEW.email THEN

        DELETE FROM action_token WHERE user_id = NEW.id AND email_token;

    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER action_token_user_email_after_update AFTER UPDATE OF email ON "user" FOR EACH ROW EXECUTE FUNCTION action_token_user_email_after_update_trigger();

`;
