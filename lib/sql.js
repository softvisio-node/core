import { sql } from "#lib/sql/query";
import { pathToFileURL } from "url";

sql.new = async function ( url, options ) {
    url = new URL( url, pathToFileURL( process.cwd() + "/" ) );

    var DBH;

    if ( url.protocol === "pgsql:" ) {
        DBH = ( await import( "#lib/sql/dbh/pgsql" ) ).default;
    }
    else if ( url.protocol === "file:" ) {
        DBH = ( await import( "#lib/sql/dbh/sqlite" ) ).default;
    }
    else {
        throw `Invalid sql protocol`;
    }

    return new DBH( url, options );
};

export default sql;
