const util = require( "util" );
const result = require( "./result/browser" );

result.Result.prototype[util.inspect.custom] = function ( depth, options ) {
    return this.toJSON();
};

module.exports = result;
