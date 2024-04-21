import sql from "#lib/sql";

export default sql`

CREATE EXTENSION IF NOT EXISTS softvisio_types;

CREATE SEQUENCE payments_user_id_seq AS int8 MAXVALUE ${ Number.MAX_SAFE_INTEGER };

CREATE TABLE payments_user (
    id int53 PRIMARY KEY DEFAULT nextval( 'payments_user_id_seq' ),
    user_id int53 NOT NULL REFERENCES "user" ( id ) ON DELETE RESTRICT,
    currency text NOT NULL,
    balance number9 NOT NULL DEFAULT 0,
    UNIQUE ( user_id, currency )
);

ALTER SEQUENCE payments_user_id_seq OWNED BY payments_user.id;

CREATE SEQUENCE payments_transaction_id_seq AS int8 MAXVALUE ${ Number.MAX_SAFE_INTEGER };

CREATE TABLE payments_transaction (
    id int53 PRIMARY KEY DEFAULT nextval( 'payments_transaction_id_seq' ),
    payments_user_id int53 NOT NULL REFERENCES payments_user ( id ) ON DELETE CASCADE,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    amount number9 NOT NULL,
    balance number9 NOT NULL,
    description text NOT NULL
);

ALTER SEQUENCE payments_transaction_id_seq OWNED BY payments_transaction.id;

CREATE FUNCTION payments_transaction_before_insert_trigger() RETURNS TRIGGER AS $$
BEGIN



    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payments_transaction_before_insert BEFIRE INSERT ON payments_transaction FOR EACH ROW EXECUTE FUNCTION payments_transaction_before_insert_trigger();

`;
