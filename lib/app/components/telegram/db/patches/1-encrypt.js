import sql from "#lib/sql";

export default async function ( dbh, { app } = {} ) {
    var res;

    res = await dbh.exec( sql`
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE telegram_bot_api_token ALTER COLUMN api_token bytea;
` );

    if ( !res.ok ) throw res;

    res = await dbh.do( sql`UPDATE telegram_bot_api_token SET api_token = decrypt_iv( api_token, ?, ?, ? )`, [

        //
        app.crypto.key,
        app.crypto.iv,
        app.crypto.type,
    ] );
    if ( !res.ok ) throw res;
}
