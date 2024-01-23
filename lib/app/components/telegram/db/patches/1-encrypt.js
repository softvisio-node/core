import sql from "#lib/sql";

export default async function ( dbh, { app } = {} ) {
    var res;

    res = await dbh.do( sql`` );
    if ( !res.ok ) throw res;

    res = await dbh.do( sql`UPDATE telegram_bot_api_token SET api_token = decrypt_iv( api_token, ?, ?, ? )`, [

        //
        app.crypto.key,
        app.crypto.iv,
        app.crypto.type,
    ] );
    if ( !res.ok ) throw res;
}
