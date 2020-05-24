const res = require( "../result" );

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
}

function db ( url ) {
    url = new URL( url );

    const Class = require( "./dbh/" + url.protocol.slice( 0, -1 ) );

    return new Class( url );
}

module.exports = db;
module.exports.Dbh = Dbh;
