import Dbh from "#lib/sql/dbh";
import PostgreSql from "#lib/sql/dbh/postgresql";
import SqLite from "#lib/sql/dbh/sqlite";
import { sql } from "#lib/sql/query";

Object.defineProperty( sql, "new", {
    "configurable": false,
    "writable": false,
    "value": function ( url, options ) {
        if ( url instanceof Dbh ) return url;

        var DBH;

        if ( url instanceof URL ) {
            if ( url.protocol === "postgresql:" || url.protocol === "postgresql+tls:" ) {
                DBH = PostgreSql;
            }
            else {
                DBH = SqLite;
            }
        }
        else if ( url.startsWith( "postgresql:" ) || url.startsWith( "postgresql+tls:" ) ) {
            DBH = PostgreSql;
        }
        else {
            DBH = SqLite;
        }

        return new DBH( url, options );
    },
} );

export default sql;
