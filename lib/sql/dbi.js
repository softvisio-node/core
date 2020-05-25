const { IS_SQL } = require( "../const" );
const { "v1": uuidv1 } = require( "uuid" );

class Query {
    static [IS_SQL] = true;

    #id;
    #query = {
        "$": null,
        "?": null,
    };
    #params;

    prepare () {
        if ( !this.#id ) this.#id = uuidv1();

        return this;
    }

    getQuery ( placeHolder ) {
        if ( this.#query["$"] == null ) {
            [this.#query["$"], this.#params] = this.buildQuery( 0 );
        }

        if ( placeHolder ) {
            if ( this.#query["?"] == null ) this.#query["?"] = this.#query["$"].replace( /\$\d+/g, "?" );

            return [this.#query["?"], this.#params, this.#id];
        }
        else {
            return [this.#query["$"], this.#params, this.#id];
        }
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
