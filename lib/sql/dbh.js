const res = require( "../result" );

const SCHEMA_PATCH_TABLE_NAME = "__schema_patch";
const SCHEMA_DEFAULT_MODULE = "main";

class Dbh {
    url;

    constructor ( url ) {
        this.url = url;
    }

    queryToString ( query, params ) {
        return query.getQuery( params, this, true )[0];
    }

    _onError ( e, query ) {
        console.error( `DBI erorr: ${e.message}\nQUERY: ${query}\n${e.stack}` );

        return res( [500, e.message] );
    }

    // MIGRATION
    addSchemaPatch ( id, module, sql ) {}

    loadSchema ( path, module ) {}

    async upgradeSchema () {}
}

function db ( url ) {
    url = new URL( url );

    const Class = require( "./dbh/" + url.protocol.slice( 0, -1 ) );

    return new Class( url );
}

module.exports = db;
module.exports.Dbh = Dbh;
// -----SOURCE FILTER LOG BEGIN-----
//
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
// | Sev.  | Line:Col      | Rule                         | Description                                                                    |
// |=======+===============+==============================+================================================================================|
// | ERROR | 3:7           | no-unused-vars               | 'SCHEMA_PATCH_TABLE_NAME' is assigned a value but never used.                  |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 4:7           | no-unused-vars               | 'SCHEMA_DEFAULT_MODULE' is assigned a value but never used.                    |
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
//
// -----SOURCE FILTER LOG END-----
