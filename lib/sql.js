import { sql } from "#lib/sql/query";
import Dbh from "#lib/sql/dbh";

Object.defineProperty( sql, "new", {
    "value": async function ( url, options ) {
        var DBH;

        if ( url instanceof URL ) {
            if ( url.protocol === "postgresql:" || url.protocol === "postgresql+ssl:" ) {
                DBH = ( await import( "#lib/sql/dbh/postgresql" ) ).default;
            }
            else {
                DBH = ( await import( "#lib/sql/dbh/sqlite" ) ).default;
            }
        }
        else if ( url.startsWith( "postgresql:" ) || url.startsWith( "postgresql+ssl:" ) ) {
            DBH = ( await import( "#lib/sql/dbh/postgresql" ) ).default;
        }
        else {
            DBH = ( await import( "#lib/sql/dbh/sqlite" ) ).default;
        }

        if ( url instanceof Dbh ) return url;

        return new DBH( url, options );
    },
} );

export default sql;
