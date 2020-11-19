const _util = require( "util" );
const result = require( "./result/browser" );

result.Result.prototype[_util.inspect.custom] = function ( depth, options ) {
    return this.toJSON();
};

module.exports = result;
