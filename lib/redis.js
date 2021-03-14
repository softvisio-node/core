const redis = require( "redis" );

module.exports.connect = function ( ...args ) {
    return redis.createClient( ...args );
};
