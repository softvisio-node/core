const fs = require( "fs" );
const ejs = require( "ejs" );

const BASE_DIR = "/var/run/nginx";
const VHOSTS_DIR = BASE_DIR + "/vhost";

module.exports.installLoadBalancerConfig = function ( id, port, hosts ) {
    const conf = ejs.render( fs.readFileSync( __dirname + "/../../resources/tmpl/nginx/vhost-load-balancer.nginx.conf", "utf8" ), { id, port, hosts } );

    fs.writeFileSync( VHOSTS_DIR + "/" + id + ".nginx.conf", conf );
};

module.exports.removeLoadBalancerConfig = function ( id ) {
    fs.unlinkFileSync( VHOSTS_DIR + "/" + id + ".nginx.conf" );
};
