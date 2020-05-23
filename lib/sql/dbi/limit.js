const { IS_SQL } = require( "../../const" );
const { Query } = require( "../dbi" );

module.exports = function ( value, options ) {
    // called as LIMIT`...`
    if ( Array.isArray( value ) ) {
        throw Error( `SQL LIMIT doe not support subqueries.` );
    }

    // called as LIMIT(sql`...`, options)
    else if ( value != null && value.constructor[IS_SQL] ) {
        throw Error( `SQL LIMIT doe not support subqueries.` );
    }

    // called as LIMIT("...", options)
    else {
        return new Limit( value, options );
    }
};

class Limit extends Query {
    value;
    max;
    default;

    constructor ( value, options ) {
        super();

        this.value = value;

        if ( options ) {
            this.max = options.max;
            this.default = options.default;
        }
    }

    buildQuery ( n ) {
        var value;

        if ( !this.value ) {
            value = this.default || this.max;
        }
        else if ( this.max ) {
            value = this.value > this.max ? this.max : this.value;
        }
        else {
            value = this.value;
        }

        if ( value ) {
            return ["LIMIT $" + ++n, [value]];
        }
        else {
            return null;
        }
    }
}
