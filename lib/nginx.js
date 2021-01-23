const fs = require( "fs" );
const ejs = require( "ejs" );

const BASE_DIR = "/var/lib/nginx";
const CACHE_DIR = BASE_DIR + "/cache";
const VHOSTS_DIR = BASE_DIR + "/vhosts";

module.exports.installLoadBalancerConfig = function ( id, upstreamHost, upstreamPort, serverName ) {
    if ( !fs.existsSync( CACHE_DIR ) ) fs.mkdirSync( CACHE_DIR, { "recursive": true } );
    if ( !fs.existsSync( VHOSTS_DIR ) ) fs.mkdirSync( VHOSTS_DIR, { "recursive": true } );

    const conf = ejs.render( fs.readFileSync( __dirname + "/../resources/tmpl/nginx/vhost-load-balancer.nginx.conf", "utf8" ), {
        id,
        "upstream_server": upstreamHost + ":" + upstreamPort,
        "listen_v6": false,
        "server_name": serverName,
        "cache_dir": CACHE_DIR,
    } );

    fs.writeFileSync( VHOSTS_DIR + "/" + id + ".nginx.conf", conf );
};

module.exports.removeLoadBalancerConfig = function ( id ) {
    fs.unlinkFileSync( VHOSTS_DIR + "/" + id + ".nginx.conf" );
};
