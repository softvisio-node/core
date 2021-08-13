import { sql } from "#lib/sql/query";

sql.new = async function ( url, options ) {
    url = new URL( url );

    var DBH;

    if ( url.protocol === "pgsql:" ) {
        DBH = ( await import( "./sql/dbh/pgsql.js" ) ).default;
    }
    else if ( url.protocol === "sqlite:" || url.protocol === "file:" ) {
        DBH = ( await import( "./sql/dbh/sqlite.js" ) ).default;
    }
    else {
        throw `Invalid sql protocol`;
    }

    return new DBH( url, options );
};

export default sql;
