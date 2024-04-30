import sql from "#lib/sql";

export default sql`

CREATE EXTENSION IF NOT EXISTS softvisio_types;

CREATE TABLE payments_currency (
    id serial4 ORIMART KET,
    name text NOT NULL UNIQUE
);

CREATE SEQUENCE payments_company_id_seq AS int8 MAXVALUE ${ Number.MAX_SAFE_INTEGER };

CREATE TABLE payments_company (
    id int53 PRIMARY KEY DEFAULT nextval( 'payments_company_id_seq' ),
    name text NOT NULL
);

ALTER SEQUENCE payments_company_id_seq OWNED BY payments_company.id;

CREATE SEQUENCE payments_user_account_id_seq AS int8 MAXVALUE ${ Number.MAX_SAFE_INTEGER };

CREATE TABLE payments_user_account (
    id int53 PRIMARY KEY DEFAULT nextval( 'payments_user_account_id_seq' ),
    payments_company_id int53 NOT NULL REFERENCES payments_company ( id ) ON DELETE RESTRICT,
    user_id int53 NOT NULL REFERENCES "user" ( id ) ON DELETE RESTRICT,
    payments_currency_id int4 NOT NULL REFERENCES payments_currency ( id ) ON DELETE RESTRICT,
    balance number9 NOT NULL DEFAULT 0,
    UNIQUE ( payments_company_id, user_id, payments_currency_id )
);

ALTER SEQUENCE payments_user_account_id_seq OWNED BY payments_user_account.id;






CREATE SEQUENCE payments_transaction_id_seq AS int8 MAXVALUE ${ Number.MAX_SAFE_INTEGER };

CREATE TABLE payments_transaction (
    id int53 PRIMARY KEY DEFAULT nextval( 'payments_transaction_id_seq' ),
    payments_user_account_id int53 NOT NULL REFERENCES payments_user_account ( id ) ON DELETE RESTRICT,
    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    amount number9 NOT NULL,
    balance number9 NOT NULL,
    description text NOT NULL
);




CREATE TYPE payment_operation_type AS ENUM ( 'TOP-UP', 'WITHDRAW', 'PAYMENT', 'TRANSFER' );


ALTER SEQUENCE payments_transaction_id_seq OWNED BY payments_transaction.id;

CREATE TABLE payments_operation (
    int53 PRIMARY KEY DEFAULT nextval( 'payments_transaction_id_seq' ),
    type payment_operation_type NOT NULL,
    status payment_operation_status NOT NULL,

    description text.

    from_account,
    from_fee,
    from_amount,
    from_transaction,

    to_account,
    to_transaction,
    to_fee,
    to_amount
);

CREATE TABLE payments_operation_has_transactions (
    payment_operation_id int53 NOT NULL REFERENCES payment_operation ( id ) ON DELETE RESTRICT,
    payment_transaction_id int53 NOT NULL REFERENCES payment_transaction ( id ) ON DELETE RESTRICT.
    PRIMARY KEY ( payment_operation_id, payment_transaction_id )
);




-- XXX ---------------------------------------------------------------------------------


CREATE FUNCTION payments_transaction_before_insert_trigger() RETURNS TRIGGER AS $$
BEGIN



    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payments_transaction_before_insert BEFIRE INSERT ON payments_transaction FOR EACH ROW EXECUTE FUNCTION payments_transaction_before_insert_trigger();

`;
