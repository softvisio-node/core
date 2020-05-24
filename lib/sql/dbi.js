const { IS_SQL } = require( "../const" );
const { "v1": uuidv1 } = require( "uuid" );

class Query {
    static [IS_SQL] = true;

    #id;
    #query;
    #params;

    prepare () {
        if ( this.#id == null ) this.#id = uuidv1();

        return this;
    }

    getId () {
        return this.#id;
    }

    getQuery ( params, dbh, forceToString ) {
        if ( this.#query === undefined ) {
            [this.#query, this.#params] = this.buildQuery( 0 );
        }

        if ( !params ) params = this.#params;

        if ( dbh && ( forceToString || ( params && params.length > dbh.getMaxParams() ) ) ) {
            return [this._toString( dbh, this.#query, params )];
        }
        else {
            return [this.#query, params];
        }
    }

    toString ( dbh, params ) {
        return this.getQuery( params, dbh, true )[0];
    }

    _toString ( dbh, query, params ) {
        return query.replace( /\$(\d+)/g, function ( str, idx ) {
            return dbh.quote( params[idx - 1] );
        } );
    }

    quoteId ( id ) {
        return id
            .replace( /"/g, "" )
            .split( "." )
            .map( ( item ) => `"${item}"` )
            .join( "." );
    }
}

module.exports.Query = Query;
