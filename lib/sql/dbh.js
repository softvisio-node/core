import "#lib/result";
import { Sql } from "./query.js";
import Events from "events";
import ansi from "#lib/text/ansi";

export default class Dbh extends Events {

    // public
    queryToString ( query, params ) {

        // query object
        if ( query instanceof Sql ) {

            // override params
            params ||= query.params;

            query = query.query;
        }

        if ( !params ) params = [];

        var length = params.length,
            idx = 0;

        // substitute params
        query = query.replace( /(?:\?|\$\d+)/g, () => {
            if ( idx >= length ) throw Error( `SQL number of passed params is less, than number of placeholders in the query` );

            return this.quote( params[idx++] );
        } );

        if ( idx < length ) throw Error( `SQL number of passed params is greater, than number of placeholders in the query` );

        return query;
    }

    // protected
    _onQueryError ( e, query, position ) {
        let msg = `SQL erorr: "${e.message}" in:\n`;

        if ( position ) {
            msg += query.substring( 0, position - 1 ) + ansi.bold.white.onRed( " ERROR IS HERE -> " ) + query.substring( position - 1 );
        }
        else {
            msg += query;
        }

        if ( e.stack ) msg += "\n" + e.stack;

        console.error( msg );

        return result.exception( [500, e.message] );
    }
}
