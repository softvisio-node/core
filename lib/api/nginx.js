const fs = require( "fs" );
const ejs = require( "ejs" );

const BASE_DIR = "/var/run/nginx";
const CACHE_DIR = BASE_DIR + "/cache";
const VHOSTS_DIR = BASE_DIR + "/vhost";

module.exports.installLoadBalancerConfig = function ( id, upstreamHost, upstreamPort, serverName ) {
    const conf = ejs.render( fs.readFileSync( __dirname + "/../../resources/tmpl/nginx/vhost-load-balancer.nginx.conf", "utf8" ), {
        id,
        "upstreamServer": upstreamHost + ":" + upstreamPort,
        serverName,
        CACHE_DIR,
    } );

    fs.mkdirSync( CACHE_DIR, { "recursive": true } );
    fs.mkdirSync( VHOSTS_DIR, { "recursive": true } );

    fs.writeFileSync( VHOSTS_DIR + "/" + id + ".nginx.conf", conf );
};

module.exports.removeLoadBalancerConfig = function ( id ) {
    fs.unlinkFileSync( VHOSTS_DIR + "/" + id + ".nginx.conf" );
};
