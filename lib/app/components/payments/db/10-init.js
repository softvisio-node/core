import sql from "#lib/sql";

export default sql`

CREATE EXTENSION IF NOT EXISTS softvisio_types;

-- XXX
CREATE TYPE payments_money AS number9;

CREATE TABLE payments_currency (
    id serial4 ORIMART KET,
    name text NOT NULL UNIQUE
);

CREATE SEQUENCE payments_account_id_seq AS int8 MAXVALUE ${ Number.MAX_SAFE_INTEGER };

CREATE TABLE payments_account (
    id int53 PRIMARY KEY DEFAULT nextval( 'payments_account_id_seq' ),
    acl_id int53 NOT NULL REFERENCES acl ( id ) ON DELETE RESTRICT,
    name text NOT NULL
);

ALTER SEQUENCE payments_account_id_seq OWNED BY payments_account.id;



-- XXX
CREATE TABLE payments_provider (
    payments_account_id int53 NOT NULL REFERENCES payments_account ( id ) ON DELETE RESTRICT,
);





CREATE SEQUENCE payments_user_account_id_seq AS int8 MAXVALUE ${ Number.MAX_SAFE_INTEGER };

CREATE TABLE payments_user_account (
    id int53 PRIMARY KEY DEFAULT nextval( 'payments_user_account_id_seq' ),
    payments_account_id int53 NOT NULL REFERENCES payments_account ( id ) ON DELETE RESTRICT,
    user_id int53 NOT NULL REFERENCES "user" ( id ) ON DELETE RESTRICT,
    payments_currency_id int4 NOT NULL REFERENCES payments_currency ( id ) ON DELETE RESTRICT,
    balance payments_money NOT NULL DEFAULT 0,
    UNIQUE ( payments_account_id, user_id, payments_currency_id )
);

ALTER SEQUENCE payments_user_account_id_seq OWNED BY payments_user_account.id;





CREATE TYPE payments_operation_type AS ENUM ( 'TOP-UP', 'WITHDRAW', 'PAYMENT', 'TRANSFER' );

-- XXX
CREATE TYPE payments_operation_status AS ENUM ( 'NEW', 'APPROVED', 'DECLINED', 'DONE' );

CREATE SEQUENCE payments_operation_id_seq AS int8 MAXVALUE ${ Number.MAX_SAFE_INTEGER };

CREATE TABLE payments_operation (
    int53 PRIMARY KEY DEFAULT nextval( 'payments_operation_id_seq' ),
    payments_account_id int53 NOT NULL REFERENCES payments_account ( id ) ON DELETE RESTRICT,

    type payments_operation_type NOT NULL,
    status payments_operation_status NOT NULL,

    created timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    description text.

    from_user_id int53 NOT REFERENCES "user" ( id ) ON DELETE RESTRICT,
    from_payments_currency_id int4 REFERENCES payments_currency ( id ) ON DELETE RESTRICT,
    from_fee payments_money,
    from_amount payments_money,
    from_balance payments_money,

    to_user_id int53 REFERENCES "user" ( id ) ON DELETE RESTRICT,
    to_payments_currency_id int4 REFERENCES payments_currency ( id ) ON DELETE RESTRICT,
    to_fee payments_money,
    to_amount payments_money,
    to_balance payments_money
);

ALTER SEQUENCE payments_operation_id_seq OWNED BY payments_operation.id;



-- XXX ---------------------------------------------------------------------------------


CREATE FUNCTION payments_transaction_before_insert_trigger() RETURNS TRIGGER AS $$
BEGIN



    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payments_transaction_before_insert BEFIRE INSERT ON payments_transaction FOR EACH ROW EXECUTE FUNCTION payments_transaction_before_insert_trigger();

`;
