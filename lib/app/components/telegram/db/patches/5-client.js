import sql from "#lib/sql";
import patch from "../10-client.js";

export default async dbh => {
    var res;

    res = await dbh.exec( sql`

DROP TABLE telegram_client CASCADE;

DROP FUNCTION telegram_client_after_insert_trigger;
DROP FUNCTION telegram_client_after_update_trigger;
DROP FUNCTION telegram_client_after_delete_trigger;

` );
    if ( !res.ok ) return res;

    res = await dbh.exec( patch );
    if ( !res.ok ) return res;
};
