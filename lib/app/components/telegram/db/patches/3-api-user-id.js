import sql from "#lib/sql";
import constants from "#lib/app/constants";

export default async function ( dbh ) {
    var res;

    res = await dbh.do( sql`ALTER TABLE telegram_user ADD COLUMN api_user_id int8 UNIQUE REFERENCES "user" ( id ) ON DELETE RESTRICT` );
    if ( !res.ok ) throw res;

    res = await dbh.select( sql`SELECT id, username FROM telegram_user WHERE api_user_id IS NULL` );

    if ( !res.ok ) throw users;

    const users = res.data;

    if ( users ) {
        for ( const user of users ) {
            res = await dbh.selectRow( sql`INSERT INTO "user" ( "email" ) VALUES ( ? ) RETURNING id`, [

                //
                user.data.username + constants.telegramUserDomain,
            ] );

            if ( !res.ok ) throw res;

            res = await dbh.do( sql`UPDATE telegram_user SET api_user_id = ? WHERE id = ?`, [

                //
                res.data.id,
                user.id,
            ] );
            if ( !res.ok ) throw res;
        }
    }

    res = await dbh.do( sql`ALTER TABLE telegram_user ALTER COLUMN api_user_id SET NOT NULL` );
    if ( !res.ok ) throw res;

    return result( 200 );
}
