import sql from "#lib/sql";

export default sql`

CREATE EXTENSION IF NOT EXISTS softvisio_types;

CREATE TABLE telegram_bot_payments (
    telegram_bot_id int53 PRIMARY KEY REFERENCES telegram_bot ( id ) ON DELETE CASCADE,
    balance number2 NOT NULL DEFAULT 0,
    wallet_pay_storage_api_key text
);

CREATE SEQUENCE telegram_bot_wallet_pay_order_id_seq AS int8 MAXVALUE ${ Number.MAX_SAFE_INTEGER };

CREATE TABLE telegram_bot_wallet_pay_order (
    id int53 PRIMARY KEY DEFAULT nextval( 'telegram_bot_wallet_pay_order_id_seq' ),
    telegram_bot_id int53 PRIMARY KEY REFERENCES telegram_bot ( id ) ON DELETE CASCADE,
    amount number2 NOT NULL
);

CREATE TYPE telegram_bot_payments_wallet_pay_order_status AS ENUM ( 'ACTIVE', 'EXPIRED', 'PAID', 'CANCELLED' );

ALTER SEQUENCE telegram_bot_wallet_pay_order_id_seq OWNED BY telegram_bot_wallet_pay_order.id;

CREATE TABLE telegram_bot_wallet_pay_order (
    id int53 PRIMARY KEY,
    order_id int53 NOT NOLL,
    telegram_user_id int53 NOT NULL,
    currency_code text NOT NULL,
    status telegram_bot_payments_wallet_pay_order_status NOT NULL,
    created timestamptz NOT NULL,
    expires timestamptz NOT NULL,
    pay_link text NOT NULL,
    direct_pay_link text NOT NULL,
    UNIQUE ( order_id, telegram_user_id, status )
);

`;
