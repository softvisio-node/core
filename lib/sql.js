import { sql } from "#lib/sql/query";
import Dbh from "#lib/sql/dbh";

Object.defineProperty( sql, "new", {
    "value": async function ( url, options ) {
        if ( url instanceof Dbh ) return url;

        url = new URL( url, "file:/a:/" );

        var DBH;

        if ( url.protocol === "pgsql:" ) {
            DBH = ( await import( "#lib/sql/dbh/pgsql" ) ).default;
        }
        else if ( url.protocol === "file:" ) {
            DBH = ( await import( "#lib/sql/dbh/sqlite" ) ).default;
        }
        else {
            throw Error( `Invalid SQL protocol` );
        }

        return new DBH( url, options );
    },
} );

export default sql;
