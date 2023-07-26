import { sql } from "#lib/sql/query";
import Dbh from "#lib/sql/dbh";

Object.defineProperty( sql, "new", {
    "value": async function ( url, options ) {
        if ( url instanceof Dbh ) return url;

        const fileUrl = new URL( url, "file:" );

        var DBH;

        if ( fileUrl.protocol === "postgresql:" ) {
            DBH = ( await import( "#lib/sql/dbh/pgsql" ) ).default;
        }
        else if ( fileUrl.protocol === "file:" ) {
            DBH = ( await import( "#lib/sql/dbh/sqlite" ) ).default;
        }
        else {
            throw Error( `Invalid SQL protocol` );
        }

        return new DBH( url, options );
    },
} );

export default sql;
