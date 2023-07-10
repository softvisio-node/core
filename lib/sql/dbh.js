import "#lib/result";
import { Sql } from "./query.js";
import Events from "#lib/events";
import ansi from "#lib/text/ansi";

export default class Dbh extends Events {

    // public
    queryToString ( query, params ) {

        // query object
        if ( query instanceof Sql ) {
            params ||= query.params;

            query = this.isSqlite ? query.sqliteQuery : query.query;
        }

        params ||= [];

        var length = params.length,
            idx = 0;

        // substitute params
        query = query.replaceAll( "?", () => {
            if ( idx >= length ) throw Error( `SQL number of passed params is less, than number of placeholders in the query` );

            return this.quote( params[idx++] );
        } );

        if ( idx < length ) throw Error( `SQL number of passed params is greater, than number of placeholders in the query` );

        return query;
    }

    // protected
    _onQueryError ( e, query, meta, silent ) {
        let msg = `SQL erorr: "${ansi.hl( e.message || e )}" in${meta?.where ? " " + ansi.hl( meta.where ) + "," : ""} query:\n`;

        if ( meta?.position ) {
            msg += query.substring( 0, meta.position - 1 ) + ansi.bold.white.onRed( " ERROR IS HERE -> " ) + query.substring( meta.position - 1 );
        }
        else {
            msg += query;
        }

        if ( e.stack ) msg += "\n" + e.stack;

        if ( !silent ) console.error( msg );

        return result.exception( [500, e.message || e], null, { "code": meta?.code } );
    }
}
