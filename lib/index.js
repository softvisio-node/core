require( "./index/browser" );

// Result
const util = require( "util" );
const result = require( "./result" );

result.Result.prototype[util.inspect.custom] = function ( depth, options ) {
    return this.toJSON();
};

global.result = result;
