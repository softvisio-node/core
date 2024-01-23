import sql from "#lib/sql";

export default async function ( dbh, { app } = {} ) {
    var res;

    res = await dbh.exec(
        sql`
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE telegram_bot_api_token ALTER COLUMN api_token TYPE bytea USING encrypt_iv( api_token::bytea, ?, ?, ? );
`,
        [

            //
            app.crypto.key,
            app.crypto.iv,
            app.crypto.type,
        ]
    );

    if ( !res.ok ) throw res;
}
