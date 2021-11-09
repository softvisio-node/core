import { sql, calcOffsetLimit } from "#lib/sql/query";

sql.new = async function ( url, options ) {
    url = new URL( url, "file:/a:/" );

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

sql.calcOffsetLimit = calcOffsetLimit;

export default sql;
