const Proxy = require( "./proxy/proxy" );

module.exports = function ( url, options ) {
    return Proxy.new( url, options );
};

module.exports.registerProxy = function ( protocol, Class ) {
    return Proxy.register( protocol, Class );
};
