const { IS_SQL } = require( "../../const" );
const { Query } = require( "../dbi" );

module.exports = function ( value ) {
    // called as OFFSET`...`
    if ( Array.isArray( value ) ) {
        throw Error( `SQL OFFSET doe not support subqueries.` );
    }

    // called as OFFSET(sql`...`, options)
    else if ( value != null && value.constructor[IS_SQL] ) {
        throw Error( `SQL OFFSET doe not support subqueries.` );
    }

    // called as OFFSET("...")
    else {
        return new Offset( value );
    }
};

class Offset extends Query {
    value;

    constructor ( value, options ) {
        super();

        this.value = value;
    }

    buildQuery ( n ) {
        if ( this.value ) {
            return ["OFFSET $" + ++n, [this.value]];
        }
        else {
            return null;
        }
    }
}
