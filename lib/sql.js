import { sql } from "#lib/sql/dbi";

sql.sql = sql;

sql.new = async function ( url, options ) {
    url = new URL( url );

    var Class;

    if ( url.protocol === "pgsql:" ) {
        Class = ( await import( "./dbd/pgsql.js" ) ).default;
    }
    else if ( url.protocol === "sqlite:" || url.protocol === "file:" ) {
        Class = ( await import( "./dbd/sqlite.js" ) ).default;
    }
    else {
        throw `Invalid sql protocol`;
    }

    return new Class( url, options );
};

export default sql;
