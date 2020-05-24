const { IS_SQL } = require( "../const" );
const { "v1": uuidv1 } = require( "uuid" );

class Query {
    static [IS_SQL] = true;

    #id;
    #query; // [query, params]
    #asString;

    getQuery () {
        if ( this.#query === undefined ) {
            this.#query = this.buildQuery( 0 );
        }

        return this.#query;
    }

    prepare () {
        if ( this.#id == null ) this.#id = uuidv1();

        return this;
    }

    getId () {
        return this.#id;
    }

    // TODO
    toString ( dbh ) {
        if ( this.#asString == null ) {
            // TODO
        }

        return this.#asString;
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
