import sql from "#lib/sql";

export default sql`

CREATE EXTENSION IF NOT EXISTS softvisio_types;

CREATE SEQUENCE translations_message_id_seq AS int8 MAXVALUE ${ Number.MAX_SAFE_INTEGER };

CREATE TABLE translations_message (
    id int53 PRIMARY KEY DEFAULT nextval( 'translations_message_id_seq' )
);

ALTER SEQUENCE translations_message_id_seq OWNED BY translations_message.id;

CREATE TABLE translations_message_translation (
    translations_message_id int53 NOT NULL REFERENCES translations_message ( id ) ON DELETE CASCADE,
    language text NOT NULL,
    singular text NOT NULL,
    plural text NOT NULL,
    translations json NOT NULL,
    fuzzy boolean NOT NULL DEFAULT true,
    PRIMARY KEY ( translations_message_id, language, singular, plural )
);

`;
